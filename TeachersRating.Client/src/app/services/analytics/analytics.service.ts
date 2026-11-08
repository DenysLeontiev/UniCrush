import { Injectable, inject } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { environment } from '../../../environments/environment.development';

export type AnalyticsEventType = 'pageview' | 'vote' | 'comment' | 'search' | 'swipe_start' | 'share';

interface QueuedEvent {
  type: AnalyticsEventType;
  path: string;
  entityId?: string | null;
  value?: string | null;
  at: string;
}

const VISITOR_KEY = 'uc-vid';
const SESSION_KEY = 'uc-session';
const SESSION_TIMEOUT_MS = 30 * 60 * 1000;
/** Events are sent in batches: every 10 s, at 20 queued events, or when the tab is hidden/closed. */
const FLUSH_INTERVAL_MS = 10_000;

function randomId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = (Math.random() * 16) | 0;
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
      });
}

/**
 * First-party, cookie-less analytics: an anonymous random visitor id (localStorage) and a
 * session id (30 min inactivity). Country/device are derived on the server; no IPs are stored.
 * Admin pages are never tracked.
 */
@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  private router = inject(Router);
  private queue: QueuedEvent[] = [];
  private readonly endpoint = `${environment.baseUrl}/track`;
  private started = false;

  /** Session-scoped acquisition info (first page of the session). */
  private referrer: string | null = null;
  private utm: { source?: string; medium?: string; campaign?: string } = {};

  readonly visitorId = this.loadVisitorId();

  start(): void {
    if (this.started) return;
    this.started = true;

    this.captureAcquisition();

    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(e => this.track('pageview', { path: e.urlAfterRedirects }));

    setInterval(() => this.flush(), FLUSH_INTERVAL_MS);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') this.flush(true);
    });
    window.addEventListener('pagehide', () => this.flush(true));
  }

  track(type: AnalyticsEventType, data: { path?: string; entityId?: string | null; value?: string | null } = {}): void {
    const path = (data.path ?? this.router.url).split('?')[0];
    if (path.startsWith('/admin')) return;

    this.queue.push({ type, path, entityId: data.entityId ?? null, value: data.value ?? null, at: new Date().toISOString() });
    if (this.queue.length >= 20) this.flush();
  }

  private flush(useBeacon = false): void {
    if (this.queue.length === 0) return;

    const events = this.queue.splice(0, 50);
    const body = JSON.stringify({
      visitorId: this.visitorId,
      sessionId: this.sessionId(),
      context: {
        screenWidth: window.screen?.width,
        screenHeight: window.screen?.height,
        theme: document.documentElement.getAttribute('data-theme'),
        language: navigator.language,
        referrer: this.referrer,
        utmSource: this.utm.source,
        utmMedium: this.utm.medium,
        utmCampaign: this.utm.campaign,
      },
      events,
    });

    try {
      if (useBeacon && navigator.sendBeacon) {
        navigator.sendBeacon(this.endpoint, new Blob([body], { type: 'application/json' }));
        return;
      }
      fetch(this.endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true })
        .catch(() => { /* analytics must never break the app */ });
    } catch {
      /* ignore */
    }
  }

  private loadVisitorId(): string {
    try {
      let id = localStorage.getItem(VISITOR_KEY);
      if (!id || !/^[A-Za-z0-9-]{8,64}$/.test(id)) {
        id = randomId();
        localStorage.setItem(VISITOR_KEY, id);
      }
      return id;
    } catch {
      return randomId();
    }
  }

  /** Same session while the visitor keeps interacting; a new one after 30 min of inactivity. */
  private sessionId(): string {
    const now = Date.now();
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      const session = raw ? (JSON.parse(raw) as { id: string; last: number }) : null;
      const id = session && now - session.last < SESSION_TIMEOUT_MS ? session.id : randomId();
      localStorage.setItem(SESSION_KEY, JSON.stringify({ id, last: now }));
      return id;
    } catch {
      return this.visitorId;
    }
  }

  private captureAcquisition(): void {
    try {
      const ref = document.referrer;
      this.referrer = ref && !ref.startsWith(location.origin) ? ref : null;

      const params = new URLSearchParams(location.search);
      this.utm = {
        source: params.get('utm_source') ?? undefined,
        medium: params.get('utm_medium') ?? undefined,
        campaign: params.get('utm_campaign') ?? undefined,
      };
    } catch {
      /* ignore */
    }
  }
}

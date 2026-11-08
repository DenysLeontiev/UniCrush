import { Injectable, computed, signal } from '@angular/core';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'uc-theme';
const THEME_COLORS: Record<Theme, string> = { light: '#FFFAF5', dark: '#15110F' };

/**
 * Follows the device setting (prefers-color-scheme) until the user picks a theme with the toggle.
 * Picking the theme that matches the device again goes back to "follow the device".
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly media = window.matchMedia('(prefers-color-scheme: dark)');
  private readonly systemTheme = signal<Theme>(this.media.matches ? 'dark' : 'light');
  private readonly override = signal<Theme | null>(this.readOverride());

  readonly theme = computed<Theme>(() => this.override() ?? this.systemTheme());
  readonly isDark = computed(() => this.theme() === 'dark');

  constructor() {
    this.media.addEventListener('change', (e) => {
      this.systemTheme.set(e.matches ? 'dark' : 'light');
      if (!this.override()) {
        this.apply(this.theme(), null);
      }
    });
    this.apply(this.theme(), null);
  }

  toggle(event?: Event): void {
    const next: Theme = this.isDark() ? 'light' : 'dark';
    this.override.set(next === this.systemTheme() ? null : next);
    this.persist();
    this.apply(next, event ?? null);
  }

  private apply(theme: Theme, event: Event | null): void {
    const root = document.documentElement;
    if (root.getAttribute('data-theme') === theme) {
      return;
    }

    const commit = () => {
      root.setAttribute('data-theme', theme);
      root.style.colorScheme = theme;
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLORS[theme]);
    };

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const doc = document as Document & { startViewTransition?: (cb: () => void) => { finished: Promise<void>; ready: Promise<void> } };

    // Seamless: a short cross-fade of the whole page (see ::view-transition in styles.scss).
    if (!event || reducedMotion || !doc.startViewTransition) {
      commit();
      return;
    }

    const transition = doc.startViewTransition(commit);
    transition.ready.catch(() => {});
    transition.finished.catch(() => {});
  }

  private readOverride(): Theme | null {
    try {
      const value = localStorage.getItem(STORAGE_KEY);
      return value === 'dark' || value === 'light' ? value : null;
    } catch {
      return null;
    }
  }

  private persist(): void {
    try {
      const value = this.override();
      if (value) {
        localStorage.setItem(STORAGE_KEY, value);
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      /* storage unavailable (private mode) — theme still works for this visit */
    }
  }
}

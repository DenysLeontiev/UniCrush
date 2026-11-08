import { Injectable, inject } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { HubConnection, HubConnectionBuilder, HubConnectionState, LogLevel } from '@microsoft/signalr';
import { BehaviorSubject, Observable, filter } from 'rxjs';
import { environment } from '../../../environments/environment.development';
import { AnalyticsService } from '../analytics/analytics.service';
import { LiveSnapshot } from '../../models/admin.model';

/**
 * Live presence: every tab connects to /hubs/online with its anonymous visitor id and reports
 * the page it is on. Admins additionally receive live snapshots.
 */
@Injectable({ providedIn: 'root' })
export class PresenceService {
  private router = inject(Router);
  private analytics = inject(AnalyticsService);

  private snapshotSource = new BehaviorSubject<LiveSnapshot | null>(null);
  public snapshot$: Observable<LiveSnapshot | null> = this.snapshotSource.asObservable();

  private hubConnection?: HubConnection;
  private hubUrl: string = environment.hubUrl;
  private ready?: Promise<void>;

  public startConection(): Promise<void> {
    if (this.ready) return this.ready;

    this.hubConnection = new HubConnectionBuilder()
      .withUrl(`${this.hubUrl}/online?v=${encodeURIComponent(this.analytics.visitorId)}`)
      .withAutomaticReconnect()
      .configureLogging(LogLevel.Warning)
      .build();

    this.hubConnection.on('PresenceSnapshot', (snapshot: LiveSnapshot) => this.snapshotSource.next(snapshot));
    this.hubConnection.onreconnected(() => this.reportPage());

    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(() => this.reportPage());

    this.ready = this.hubConnection.start()
      .then(() => this.reportPage())
      .catch(error => console.warn('Presence connection failed', error));

    return this.ready;
  }

  public stopHubConnection(): void {
    this.hubConnection?.stop();
  }

  public async joinAdminGroup(): Promise<void> {
    await this.startConection();
    if (this.hubConnection?.state !== HubConnectionState.Connected) return;

    try {
      await this.hubConnection.invoke('JoinAdminGroup');
    } catch {
      // The connection was opened before logging in (no auth cookie yet): reconnect and retry.
      await this.hubConnection.stop();
      await this.hubConnection.start();
      this.reportPage();
      await this.hubConnection.invoke('JoinAdminGroup');
    }
  }

  public async leaveAdminGroup(): Promise<void> {
    if (this.hubConnection?.state === HubConnectionState.Connected) {
      await this.hubConnection.invoke('LeaveAdminGroup').catch(() => {});
    }
  }

  private reportPage(): void {
    if (this.hubConnection?.state === HubConnectionState.Connected) {
      this.hubConnection.invoke('SetPage', this.router.url.split('?')[0]).catch(() => {});
    }
  }
}

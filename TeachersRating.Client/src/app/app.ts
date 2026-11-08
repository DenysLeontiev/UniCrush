import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { PresenceService } from './services/presence/presence.service';
import { ThemeService } from './services/theme/theme.service';
import { SelectionStore } from './services/selection/selection.store';
import { ToastService } from './services/toast/toast.service';
import { AnalyticsService } from './services/analytics/analytics.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, FontAwesomeModule],
  templateUrl: './app.html'
})
export class App implements OnInit, OnDestroy {
  private presenceService = inject(PresenceService);
  readonly theme = inject(ThemeService);
  readonly selection = inject(SelectionStore);
  readonly toast = inject(ToastService);
  private analytics = inject(AnalyticsService);

  constructor() {
    this.analytics.start();
  }

  async ngOnInit(): Promise<void> {
    await this.presenceService.startConection();
  }

  ngOnDestroy(): void {
    this.presenceService.stopHubConnection();
  }
}

import { Injectable, inject } from '@angular/core';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { Router } from '@angular/router';
import { AnalyticsService } from '../analytics/analytics.service';
import { TeacherSummary } from '../../models/leaderboard.model';
import { WorkerComments } from '../../modals/worker-comments/worker-comments';
import { ShareModal } from '../../modals/share-modal/share-modal';

/** One place that opens the app's bottom sheets with consistent styling. */
@Injectable({ providedIn: 'root' })
export class SheetsService {
  private bottomSheet = inject(MatBottomSheet);
  private router = inject(Router);
  private analytics = inject(AnalyticsService);

  openTeacher(teacher: TeacherSummary, options: { showProfileLink?: boolean } = {}): void {
    const url = this.router.url;
    const source = url.startsWith('/comparison') ? 'swipe' : url.startsWith('/teacher') ? 'profile' : url.startsWith('/leaderboard') ? 'leaderboard' : 'other';
    this.analytics.track('open_comments', { entityId: teacher.id, value: source });

    this.bottomSheet.open(WorkerComments, {
      data: { workerId: teacher.id, teacher, showProfileLink: options.showProfileLink ?? true },
      panelClass: 'uc-sheet',
      autoFocus: false,
    });
  }

  openShare(): void {
    this.bottomSheet.open(ShareModal, {
      panelClass: 'uc-sheet',
      autoFocus: false,
    });
  }
}

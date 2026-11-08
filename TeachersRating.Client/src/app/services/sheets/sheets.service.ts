import { Injectable, inject } from '@angular/core';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { TeacherSummary } from '../../models/leaderboard.model';
import { WorkerComments } from '../../modals/worker-comments/worker-comments';
import { ShareModal } from '../../modals/share-modal/share-modal';

/** One place that opens the app's bottom sheets with consistent styling. */
@Injectable({ providedIn: 'root' })
export class SheetsService {
  private bottomSheet = inject(MatBottomSheet);

  openTeacher(teacher: TeacherSummary, options: { showProfileLink?: boolean } = {}): void {
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

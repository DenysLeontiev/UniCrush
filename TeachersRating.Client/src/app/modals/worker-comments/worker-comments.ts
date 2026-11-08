import { Component, ElementRef, OnDestroy, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MAT_BOTTOM_SHEET_DATA, MatBottomSheetRef } from '@angular/material/bottom-sheet';
import { Router } from '@angular/router';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { CommentsService } from '../../services/comments/comments.service';
import { ToastService } from '../../services/toast/toast.service';
import { AnalyticsService } from '../../services/analytics/analytics.service';
import { CommentsQueryParams } from '../../models/queryParams/commentsQueryParams.model';
import { CommentRepliesQueryParams } from '../../models/queryParams/commentRepliesQueryParams.model';
import { TeacherSummary } from '../../models/leaderboard.model';
import { Comment } from '../../models/comment.model';
import { Avatar } from '../../shared/avatar/avatar';
import { TimeAgoPipe } from '../../pipes/time-ago/time-ago.pipe';

export interface WorkerCommentsData {
  workerId: string;
  teacher?: TeacherSummary;
  /** Show a link to the full stats page (off when opened from that page). */
  showProfileLink?: boolean;
}

const MAX_LENGTH = 1000;
const NAME_MAX_LENGTH = 40;
const NAME_STORAGE_KEY = 'uc-comment-name';

@Component({
  selector: 'app-worker-comments',
  imports: [FontAwesomeModule, Avatar, TimeAgoPipe],
  templateUrl: './worker-comments.html'
})
export class WorkerComments implements OnInit, OnDestroy {
  readonly data = inject<WorkerCommentsData>(MAT_BOTTOM_SHEET_DATA);
  private sheetRef = inject(MatBottomSheetRef<WorkerComments>);
  readonly commentsService = inject(CommentsService);
  private toast = inject(ToastService);
  private router = inject(Router);
  private analytics = inject(AnalyticsService);

  readonly composer = viewChild<ElementRef<HTMLTextAreaElement>>('composer');

  readonly comments = toSignal(this.commentsService.commentsForWorker$, { initialValue: null });
  readonly replies = toSignal(this.commentsService.repliesForComment$, { initialValue: null });

  readonly text = signal('');
  readonly submitting = signal(false);
  readonly loadingInitial = signal(true);
  readonly loadingMore = signal(false);
  readonly replyTo = signal<Comment | null>(null);
  readonly expandedId = signal<string | null>(null);
  readonly repliesLoading = signal(false);
  readonly maxLength = MAX_LENGTH;
  readonly nameMaxLength = NAME_MAX_LENGTH;

  /** Forum-style signature: optional, remembered between visits. Empty = "Анонім". */
  readonly authorName = signal(this.readSavedName());

  readonly canSend = computed(() => this.text().trim().length > 0 && !this.submitting());
  readonly totalCount = computed(() => this.comments()?.totalCount ?? 0);

  private queryParams = new CommentsQueryParams();
  private repliesParams = new CommentRepliesQueryParams();

  ngOnInit(): void {
    this.commentsService.clearComments();
    this.commentsService.clearReplies();
    this.commentsService.getPaginatedComments(this.data.workerId, this.queryParams).subscribe({
      next: () => this.loadingInitial.set(false),
      error: () => this.loadingInitial.set(false),
    });
  }

  ngOnDestroy(): void {
    this.commentsService.clearComments();
    this.commentsService.clearReplies();
  }

  close(): void {
    this.sheetRef.dismiss();
  }

  openProfile(): void {
    this.sheetRef.dismiss();
    this.router.navigate(['/teacher', this.data.workerId]);
  }

  onScroll(event: Event): void {
    const el = event.target as HTMLElement;
    if (el.scrollTop + el.clientHeight < el.scrollHeight - 160) return;

    const current = this.comments();
    if (!current || this.loadingMore() || current.pageNumber >= current.totalPages) return;

    this.loadingMore.set(true);
    this.queryParams.pageNumber++;
    this.commentsService.getPaginatedComments(this.data.workerId, this.queryParams).subscribe({
      next: () => this.loadingMore.set(false),
      error: () => {
        this.queryParams.pageNumber--;
        this.loadingMore.set(false);
      },
    });
  }

  onInput(el: HTMLTextAreaElement): void {
    this.text.set(el.value);
    // auto-grow
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }

  startReply(comment: Comment): void {
    this.replyTo.set(comment);
    this.composer()?.nativeElement.focus();
  }

  cancelReply(): void {
    this.replyTo.set(null);
  }

  send(): void {
    if (!this.canSend()) return;

    const parent = this.replyTo();
    const content = this.text().trim().slice(0, MAX_LENGTH);
    this.submitting.set(true);

    const authorName = this.authorName().replace(/\s+/g, ' ').trim().slice(0, NAME_MAX_LENGTH) || null;
    this.authorName.set(authorName ?? '');
    this.saveName(authorName ?? '');

    this.commentsService.addComment(this.data.workerId, { content, authorName, parentCommentId: parent?.id }).subscribe({
      next: () => {
        this.submitting.set(false);
        this.text.set('');
        const el = this.composer()?.nativeElement;
        if (el) {
          el.value = '';
          el.style.height = 'auto';
        }
        this.replyTo.set(null);
        navigator.vibrate?.(8);
        this.analytics.track('comment', { entityId: this.data.workerId, value: parent ? 'reply' : 'comment' });

        if (parent) {
          // Show the thread we just replied to, freshly loaded.
          this.openReplies(parent.id, true);
        }
      },
      error: () => {
        this.submitting.set(false);
        this.toast.show('Не вдалося надіслати. Спробуй ще раз.');
      },
    });
  }

  toggleReplies(comment: Comment): void {
    if (this.expandedId() === comment.id) {
      this.expandedId.set(null);
      this.commentsService.clearReplies();
      return;
    }
    this.openReplies(comment.id, false);
  }

  private openReplies(commentId: string, force: boolean): void {
    if (this.expandedId() === commentId && !force) return;

    this.expandedId.set(commentId);
    this.commentsService.clearReplies();
    this.repliesParams = new CommentRepliesQueryParams();
    this.repliesLoading.set(true);
    this.commentsService.getPaginatedReplies(commentId, this.repliesParams).subscribe({
      next: () => this.repliesLoading.set(false),
      error: () => this.repliesLoading.set(false),
    });
  }

  onNameInput(value: string): void {
    this.authorName.set(value);
  }

  displayName(comment: Comment): string {
    return comment.authorName?.trim() || 'Анонім';
  }

  initials(comment: Comment): string {
    const words = (comment.authorName ?? '').trim().split(/\s+/).filter(Boolean);
    return words.slice(0, 2).map(w => w[0]).join('').toUpperCase();
  }

  private readSavedName(): string {
    try {
      return localStorage.getItem(NAME_STORAGE_KEY) ?? '';
    } catch {
      return '';
    }
  }

  private saveName(name: string): void {
    try {
      if (name) localStorage.setItem(NAME_STORAGE_KEY, name);
      else localStorage.removeItem(NAME_STORAGE_KEY);
    } catch {
      /* storage unavailable */
    }
  }

  canLoadMoreReplies(): boolean {
    const r = this.replies();
    return !!r && r.pageNumber < r.totalPages;
  }

  loadMoreReplies(commentId: string): void {
    if (this.repliesLoading()) return;
    this.repliesLoading.set(true);
    this.repliesParams.pageNumber++;
    this.commentsService.getPaginatedReplies(commentId, this.repliesParams).subscribe({
      next: () => this.repliesLoading.set(false),
      error: () => {
        this.repliesParams.pageNumber--;
        this.repliesLoading.set(false);
      },
    });
  }

  repliesWord(n: number): string {
    const mod10 = n % 10, mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return 'відповідь';
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'відповіді';
    return 'відповідей';
  }

  commentsWord(n: number): string {
    const mod10 = n % 10, mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return 'коментар';
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'коментарі';
    return 'коментарів';
  }
}

import { Component, HostListener, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { ApiService } from '../../services/api.service';
import { SelectionStore } from '../../services/selection/selection.store';
import { SheetsService } from '../../services/sheets/sheets.service';
import { AnalyticsService } from '../../services/analytics/analytics.service';
import { Worker } from '../../models/worker.model';
import { isDefaultPhoto, teacherInitials } from '../../shared/avatar/avatar';

type Phase = 'loading' | 'idle' | 'choosing' | 'error';

/** Horizontal distance (px) after which a release counts as a swipe choice. */
const SWIPE_THRESHOLD = 60;
/** Movement (px) before we decide it's a horizontal drag and not a tap / vertical scroll. */
const DRAG_START = 10;
const MAX_DRAG = 140;

/**
 * "This or that": tap the teacher you like more. The winner stays on screen (building a streak),
 * a new challenger slides in next to them.
 */
@Component({
  selector: 'app-swipe-comparison',
  standalone: true,
  imports: [FontAwesomeModule, RouterLink],
  templateUrl: './swipe-comparison.component.html'
})
export class SwipeComparisonComponent {
  private apiService = inject(ApiService);
  private selection = inject(SelectionStore);
  private sheets = inject(SheetsService);
  private analytics = inject(AnalyticsService);

  /** Bound from the route (:departmentId). */
  readonly departmentId = input.required<string>();

  readonly pair = signal<Worker[]>([]);
  readonly phase = signal<Phase>('loading');
  readonly chosenIndex = signal<number | null>(null);
  readonly enteringIndex = signal<number | null>(null);
  readonly streak = signal(0);
  readonly championId = signal<string | null>(null);
  readonly votesCount = signal(0);
  readonly errorMessage = signal('');

  // swipe gesture: swipe left = pick the left card, swipe right = pick the right card
  readonly dragX = signal(0);
  readonly dragging = signal(false);
  readonly leanIndex = computed<number | null>(() => {
    const x = this.dragX();
    if (!this.dragging() || Math.abs(x) < 20) return null;
    return x < 0 ? 0 : 1;
  });
  private pointerId: number | null = null;
  private startX = 0;
  private startY = 0;
  private suppressClick = false;

  readonly departmentTitle = computed(() => {
    const id = this.departmentId();
    const last = this.selection.last();
    if (last?.departmentId === id) return last.departmentName;
    const fromWorker = this.pair()[0]?.departments?.find(d => d.id === id);
    return fromWorker?.longName ?? 'Кафедра';
  });

  readonly instituteTitle = computed(() => {
    const last = this.selection.last();
    return last?.departmentId === this.departmentId() ? last.instituteName : '';
  });

  readonly isDefaultPhoto = isDefaultPhoto;
  readonly initials = teacherInitials;

  constructor() {
    effect(() => {
      const id = this.departmentId();
      untracked(() => this.reset(id));
    });
  }

  private reset(departmentId: string) {
    this.pair.set([]);
    this.streak.set(0);
    this.championId.set(null);
    this.votesCount.set(0);
    this.chosenIndex.set(null);
    this.loadPair(departmentId, null);
  }

  /**
   * Loads a new pair; if `keep` is given, it stays in its slot and only the other slot changes.
   * The result is applied no earlier than `minDelayMs` (lets the choose animation finish while
   * the next challenger is already being fetched and its photo preloaded).
   */
  private loadPair(departmentId: string, keep: { worker: Worker; index: number } | null, minDelayMs = 0) {
    if (!keep) this.phase.set('loading');
    const minDelay = new Promise(resolve => setTimeout(resolve, minDelayMs));

    this.apiService.getTwoRandomWorkers(departmentId).subscribe({
      next: async (workers) => {
        if (workers.length < 2) {
          this.fail('На цій кафедрі замало викладачів для порівняння.');
          return;
        }

        let next: Worker[];
        if (keep) {
          const challenger = workers.find(w => w.id !== keep.worker.id) ?? workers[0];
          await Promise.all([this.preload(challenger), minDelay]);
          next = keep.index === 0 ? [keep.worker, challenger] : [challenger, keep.worker];
          this.enteringIndex.set(1 - keep.index);
        } else {
          await Promise.all([...workers.map(w => this.preload(w)), minDelay]);
          next = workers;
          this.enteringIndex.set(null);
        }

        if (departmentId !== this.departmentId()) return; // user switched department meanwhile

        this.pair.set(next);
        this.chosenIndex.set(null);
        this.phase.set('idle');
        setTimeout(() => this.enteringIndex.set(null), 600);
      },
      error: (err) => {
        this.fail(err?.status === 400
          ? 'На цій кафедрі замало викладачів для порівняння.'
          : 'Не вдалося завантажити викладачів. Перевір інтернет і спробуй ще раз.');
      }
    });
  }

  private fail(message: string) {
    this.errorMessage.set(message);
    this.phase.set('error');
  }

  /** Wait (briefly) for the photo so the card doesn't pop in empty. */
  private preload(worker: Worker): Promise<void> {
    const url = worker.photo?.url;
    if (isDefaultPhoto(url)) return Promise.resolve();

    return new Promise(resolve => {
      const img = new Image();
      const done = () => resolve();
      img.onload = done;
      img.onerror = done;
      img.src = url;
      setTimeout(done, 900);
    });
  }

  choose(index: number, method: 'tap' | 'swipe' | 'key' = 'tap') {
    if (this.phase() !== 'idle') return;
    const pair = this.pair();
    if (pair.length !== 2) return;

    const winner = pair[index];
    const loser = pair[1 - index];

    this.phase.set('choosing');
    this.chosenIndex.set(index);
    navigator.vibrate?.(12);

    // Optimistic counters.
    this.pair.set(pair.map(w =>
      w.id === winner.id ? { ...w, numberOfLikes: w.numberOfLikes + 1 }
      : w.id === loser.id ? { ...w, numberOfDislikes: w.numberOfDislikes + 1 }
      : w));

    this.analytics.track('vote', { entityId: winner.id, value: method });
    this.apiService.likeWorker(winner.id).subscribe({ error: (e) => console.warn('Like failed', e) });
    this.apiService.dislikeWorker(loser.id).subscribe({ error: (e) => console.warn('Dislike failed', e) });

    this.streak.set(this.championId() === winner.id ? this.streak() + 1 : 1);
    this.championId.set(winner.id);
    this.votesCount.update(n => n + 1);

    const updatedWinner = this.pair()[index];
    this.loadPair(this.departmentId(), { worker: updatedWinner, index }, 620);
  }

  // ---------- gestures ----------

  onPointerDown(event: PointerEvent) {
    if (this.phase() !== 'idle' || !event.isPrimary) return;
    if ((event.target as HTMLElement).closest('.comments-btn')) return;

    this.pointerId = event.pointerId;
    this.startX = event.clientX;
    this.startY = event.clientY;
    this.suppressClick = false;
  }

  onPointerMove(event: PointerEvent) {
    if (event.pointerId !== this.pointerId) return;

    const dx = event.clientX - this.startX;
    const dy = event.clientY - this.startY;

    if (!this.dragging()) {
      if (Math.abs(dx) < DRAG_START || Math.abs(dx) < Math.abs(dy)) return;
      // Horizontal drag starts: keep receiving moves even outside the arena.
      this.dragging.set(true);
      this.suppressClick = true;
      (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
    }

    this.dragX.set(Math.max(-MAX_DRAG, Math.min(MAX_DRAG, dx)));
  }

  onPointerUp(event: PointerEvent) {
    if (event.pointerId !== this.pointerId) return;
    const x = this.dragX();
    const wasDragging = this.dragging();
    this.cancelDrag();

    if (wasDragging && Math.abs(x) >= SWIPE_THRESHOLD) {
      this.choose(x < 0 ? 0 : 1, 'swipe');
    }
  }

  cancelDrag() {
    this.pointerId = null;
    this.dragging.set(false);
    this.dragX.set(0);
  }

  onCardClick(index: number) {
    // A swipe ends with a click event on the card; it was already handled as a swipe.
    if (this.suppressClick) {
      this.suppressClick = false;
      return;
    }
    this.choose(index);
  }

  skip() {
    if (this.phase() === 'idle') this.analytics.track('skip');
    if (this.phase() === 'choosing' || this.phase() === 'loading') return;
    this.streak.set(0);
    this.championId.set(null);
    this.loadPair(this.departmentId(), null);
  }

  retry() {
    this.reset(this.departmentId());
  }

  openTeacher(worker: Worker, event: Event) {
    event.stopPropagation();
    this.sheets.openTeacher({
      id: worker.id,
      fullName: worker.fullName,
      position: worker.position,
      photoUrl: worker.photo?.url ?? '',
      personalPageUrl: worker.personalPageUrl,
      likes: worker.numberOfLikes,
      dislikes: worker.numberOfDislikes,
      subtitle: this.departmentTitle(),
    });
  }

  @HostListener('document:keydown', ['$event'])
  onKey(event: KeyboardEvent) {
    const target = event.target as HTMLElement | null;
    if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
    if (document.querySelector('.mat-bottom-sheet-container')) return;

    if (event.key === 'ArrowLeft') this.choose(0, 'key');
    else if (event.key === 'ArrowRight') this.choose(1, 'key');
    else if (event.key === ' ' || event.key === 'ArrowDown') {
      event.preventDefault();
      this.skip();
    }
  }
}

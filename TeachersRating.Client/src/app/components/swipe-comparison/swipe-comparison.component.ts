import { Component, ElementRef, ViewChild, signal, computed, OnInit, DestroyRef, inject, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { fromEvent, merge } from 'rxjs';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { ApiService } from '../../services/api.service';
import { Worker } from '../../models/worker.model';

@Component({
  selector: 'app-swipe-comparison',
  standalone: true,
  imports: [CommonModule, FontAwesomeModule, RouterLink],
  templateUrl: './swipe-comparison.component.html',
  styleUrl: './swipe-comparison.component.scss'
})
export class SwipeComparisonComponent implements OnInit {
  @ViewChild('container', { static: true }) container!: ElementRef<HTMLDivElement>;

  public apiService = inject(ApiService);
  private destroyRef = inject(DestroyRef);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  departmentId = signal<string>('');

  public currentPair = signal<Worker[]>([]);
  public swipeDirection = signal<'left' | 'right' | null>(null);
  public isLoading = signal(false);
  public comparisonCount = signal(0);

  private currentWinner = signal<Worker | null>(null);
  private winnerPosition = signal<'left' | 'right' | null>(null);
  private swipeOffset = signal(0);
  private isAnimating = signal(false);

  public canSwipe = computed(() => !this.isAnimating() && !this.isLoading());

  private normalSwipeDirection = signal(false);

  private startX = 0;
  private isDragging = false;
  private animationFrameId: number | null = null;

  protected readonly Math = Math;

  public leftCardTransform = computed(() => {
    const offset = this.swipeOffset();
    return `translateX(${offset}px)`;
  });

  public rightCardTransform = computed(() => {
    const offset = this.swipeOffset();
    return `translateX(${offset}px)`;
  });

  ngOnInit() {
    const departmentId = this.route.snapshot.paramMap.get('departmentId');
    if (departmentId) {
      this.departmentId.set(departmentId);
      this.loadNextPair();
      this.setupGestureHandling();
    } else {
      this.router.navigate(['/home']);
    }
  }

  private loadNextPair() {
    this.isLoading.set(true);

    this.apiService.getTwoRandomWorkers(this.departmentId()).subscribe({
      next: (workers) => {
        if (workers.length === 2) {
          const winner = this.currentWinner();
          const position = this.winnerPosition();

          if (winner && position) {
            const newWorker = workers.find(w => w.id !== winner.id) || workers[0];

            if (position === 'right') {
              this.currentPair.set([newWorker, winner]);
            } else {
              this.currentPair.set([winner, newWorker]);
            }
            this.currentWinner.set(null);
            this.winnerPosition.set(null);
          } else {
            this.currentPair.set(workers);
          }
        }
        this.isLoading.set(false);
      },
      error: (error) => {
        this.isLoading.set(false);
        console.error('Error loading workers:', error);
      }
    });
  }

  private setupGestureHandling() {
    const element = this.container.nativeElement;

    const mouseDown$ = fromEvent<MouseEvent>(element, 'mousedown');
    const mouseMove$ = fromEvent<MouseEvent>(document, 'mousemove');
    const mouseUp$ = fromEvent<MouseEvent>(document, 'mouseup');

    const touchStart$ = fromEvent<TouchEvent>(element, 'touchstart', { passive: false });
    const touchMove$ = fromEvent<TouchEvent>(document, 'touchmove', { passive: false });
    const touchEnd$ = fromEvent<TouchEvent>(document, 'touchend');

    merge(mouseDown$, touchStart$)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => {
        if (!this.canSwipe()) return;

        event.preventDefault();
        this.startGesture(event);
      });

    merge(mouseMove$, touchMove$)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => {
        if (!this.isDragging || !this.canSwipe()) return;

        event.preventDefault();
        this.updateGesture(event);
      });

    merge(mouseUp$, touchEnd$)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => {
        if (!this.isDragging) return;

        this.endGesture();
      });
  }

  private startGesture(event: MouseEvent | TouchEvent) {
    this.isDragging = true;
    this.startX = this.getClientX(event);
    this.swipeDirection.set(null);
  }

  private updateGesture(event: MouseEvent | TouchEvent) {
    if (!this.isDragging) return;

    const currentX = this.getClientX(event);
    const deltaX = currentX - this.startX;

    const maxSwipe = 150;
    const clampedDelta = Math.max(-maxSwipe, Math.min(maxSwipe, deltaX));

    this.swipeOffset.set(clampedDelta);

    if (Math.abs(deltaX) > 20) {
      // When swiping left (negative), show on right card (the one being selected)
      // When swiping right (positive), show on left card (the one being selected)
      this.swipeDirection.set(deltaX < 0 ? 'right' : 'left');
    }
  }

  private endGesture() {
    this.isDragging = false;
    const offset = this.swipeOffset();
    const threshold = 50;

    if (Math.abs(offset) > threshold) {
      const direction = offset > 0 ? 'right' : 'left';
      this.makeSelection(direction);
    } else {
      this.resetPosition();
    }
  }

  private getClientX(event: MouseEvent | TouchEvent): number {
    return 'touches' in event ? event.touches[0].clientX : event.clientX;
  }

  makeSelection(direction: 'left' | 'right') {
    if (!this.canSwipe()) return;

    this.isAnimating.set(true);
    const pair = this.currentPair();

    if (pair.length === 2) {
      const actualDirection = this.normalSwipeDirection() ? direction : (direction === 'left' ? 'right' : 'left');

      const winner = actualDirection === 'right' ? pair[1] : pair[0];
      const loser = actualDirection === 'right' ? pair[0] : pair[1];

      console.log(`Swipe: ${direction}, Interpreted as: ${actualDirection}, Selected: ${winner.fullName}, Rejected: ${loser.fullName}`);

      this.currentWinner.set(winner);
      this.winnerPosition.set(actualDirection === 'right' ? 'right' : 'left');

      this.apiService.likeWorker(winner.id).subscribe({
        next: (likedWorker) => {
          winner.numberOfLikes = likedWorker.numberOfLikes;
          console.log('Choice recorded: ', likedWorker);
        },
        error: (error) => console.log('Failed to record choice:', error)
      });

      this.apiService.dislikeWorker(loser.id).subscribe({
        next: (dislikedWorker) => {
          loser.numberOfDislikes = dislikedWorker.numberOfDislikes;
          console.log('Choice recorded: ', dislikedWorker);
        },
        error: (error) => console.log('Failed to record choice:', error)
      });

      this.comparisonCount.update(count => count + 1);
    }

    const finalOffset = direction === 'right' ? 300 : -300;
    this.swipeOffset.set(finalOffset);

    setTimeout(() => {
      this.nextPair();
    }, 300);
  }

  private nextPair() {
    this.swipeOffset.set(0);
    this.swipeDirection.set(null);
    this.isAnimating.set(false);

    this.loadNextPair();
  }

  private resetPosition() {
    this.swipeOffset.set(0);
    this.swipeDirection.set(null);
  }

  selectLeft() {
    this.makeSelection('right');
  }

  selectRight() {
    this.makeSelection('left');
  }

  toggleSwipeDirection() {
    this.normalSwipeDirection.update(current => !current);
    console.log(`Swipe direction is now: ${this.normalSwipeDirection() ? 'Normal' : 'Inverted'}`);
  }

  public restart(): void {
    this.swipeOffset.set(0);
    this.swipeDirection.set(null);
    this.isAnimating.set(false);
    this.currentWinner.set(null);
    this.winnerPosition.set(null);
    this.comparisonCount.set(0);
    this.loadNextPair();
  }
}
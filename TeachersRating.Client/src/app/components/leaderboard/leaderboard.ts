import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { Subject, catchError, map, of, switchMap } from 'rxjs';
import { ApiService } from '../../services/api.service';
import { LeaderboardService } from '../../services/leaderboard/leaderboard.service';
import { AnalyticsService } from '../../services/analytics/analytics.service';
import { Institute } from '../../models/institute.model';
import { Department } from '../../models/department.model';
import { LeaderboardEntry, LeaderboardPeriod, LeaderboardSort, TodaysCrush } from '../../models/leaderboard.model';
import { InstituteRenamePipe } from '../../pipes/institute-rename/institute-rename-pipe';
import { Avatar } from '../../shared/avatar/avatar';
import { InViewDirective } from '../../shared/in-view/in-view.directive';

const PAGE_SIZE = 20;

@Component({
  selector: 'app-leaderboard',
  imports: [FontAwesomeModule, RouterLink, InstituteRenamePipe, Avatar, InViewDirective],
  templateUrl: './leaderboard.html',
})
export class Leaderboard {
  private api = inject(ApiService);
  private leaderboard = inject(LeaderboardService);
  private router = inject(Router);
  private analytics = inject(AnalyticsService);
  private lastTrackedSearch = '';
  private institutePipe = new InstituteRenamePipe();

  readonly periods: { value: LeaderboardPeriod; label: string }[] = [
    { value: 'today', label: 'Сьогодні' },
    { value: 'week', label: 'Тиждень' },
    { value: 'all', label: 'Весь час' },
  ];

  readonly sorts: { value: LeaderboardSort; label: string; icon: string }[] = [
    { value: 'likes', label: 'Найбільше ❤', icon: 'heart' },
    { value: 'comments', label: 'Обговорювані', icon: 'comment' },
  ];

  // filters
  readonly search = signal('');
  readonly period = signal<LeaderboardPeriod>('all');
  readonly sort = signal<LeaderboardSort>('likes');
  readonly instituteId = signal('');
  readonly departmentId = signal('');
  readonly filtersOpen = signal(false);

  readonly institutes = signal<Institute[]>([]);
  readonly departments = signal<Department[]>([]);

  // results
  readonly items = signal<LeaderboardEntry[]>([]);
  readonly totalCount = signal(0);
  readonly pageNumber = signal(1);
  readonly loading = signal(true);
  readonly loadingMore = signal(false);
  readonly failed = signal(false);
  readonly hasMore = computed(() => this.items().length < this.totalCount());

  readonly crush = signal<TodaysCrush | null>(null);
  readonly crushLoading = signal(true);

  readonly activeFilterCount = computed(() => (this.instituteId() ? 1 : 0) + (this.departmentId() ? 1 : 0));

  readonly placeLabel = computed(() => {
    const dep = this.departments().find(d => d.id === this.departmentId());
    if (dep) return dep.shortName || dep.longName;
    const inst = this.institutes().find(i => i.id === this.instituteId());
    return inst ? this.institutePipe.transform(inst.name).trim() : '';
  });

  /** Podium only for a plain ranking view. */
  readonly showPodium = computed(() => !this.search().trim() && this.items().length >= 3);
  readonly podium = computed(() => (this.showPodium() ? this.items().slice(0, 3) : []));
  readonly rest = computed(() => (this.showPodium() ? this.items().slice(3) : this.items()));

  readonly todayLabel = new Intl.DateTimeFormat('uk-UA', { day: 'numeric', month: 'long' }).format(new Date());

  readonly skeletonRows = Array.from({ length: 6 }, (_, i) => i);

  private readonly load$ = new Subject<{ reset: boolean }>();
  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.load$
      .pipe(
        switchMap(({ reset }) => {
          const page = reset ? 1 : this.pageNumber() + 1;
          return this.leaderboard
            .getLeaderboard({
              search: this.search(),
              instituteId: this.instituteId() || undefined,
              departmentId: this.departmentId() || undefined,
              period: this.period(),
              sort: this.sort(),
              pageNumber: page,
              pageSize: PAGE_SIZE,
            })
            .pipe(
              map(result => ({ result, reset, page })),
              catchError(() => of({ result: null, reset, page })),
            );
        }),
        takeUntilDestroyed(),
      )
      .subscribe(({ result, reset, page }) => {
        this.loading.set(false);
        this.loadingMore.set(false);

        if (!result) {
          this.failed.set(true);
          return;
        }

        this.failed.set(false);
        this.pageNumber.set(page);

        const term = this.search().trim();
        if (reset && term.length >= 2 && term.toLowerCase() !== this.lastTrackedSearch) {
          this.lastTrackedSearch = term.toLowerCase();
          this.analytics.track('search', { value: term });
        }
        this.totalCount.set(result.totalCount);
        this.items.set(reset ? result.items : [...this.items(), ...result.items]);
      });

    this.api.getInstitutes().subscribe(list =>
      this.institutes.set([...list].sort((a, b) =>
        this.institutePipe.transform(a.name).localeCompare(this.institutePipe.transform(b.name), 'uk'))));

    this.reload();
  }

  reload() {
    this.loading.set(true);
    this.load$.next({ reset: true });
    this.loadCrush();
  }

  loadMore() {
    if (this.loading() || this.loadingMore() || !this.hasMore() || this.failed()) return;
    this.loadingMore.set(true);
    // Scroll depth: which page of the list people reach.
    this.analytics.track('load_more', { value: String(this.pageNumber() + 1) });
    this.load$.next({ reset: false });
  }

  private loadCrush() {
    this.crushLoading.set(true);
    this.leaderboard.getTodaysCrush(this.instituteId() || undefined, this.departmentId() || undefined).subscribe({
      next: crush => {
        this.crush.set(crush);
        this.crushLoading.set(false);
      },
      error: () => this.crushLoading.set(false),
    });
  }

  onSearch(value: string) {
    this.search.set(value);
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      this.loading.set(true);
      this.load$.next({ reset: true });
    }, 280);
  }

  clearSearch(input: HTMLInputElement) {
    input.value = '';
    this.onSearch('');
    input.focus();
  }

  setPeriod(period: LeaderboardPeriod) {
    if (this.period() === period) return;
    this.period.set(period);
    this.analytics.track('filter', { value: `period:${period}` });
    this.loading.set(true);
    this.load$.next({ reset: true });
  }

  setSort(sort: LeaderboardSort) {
    if (this.sort() === sort) return;
    this.sort.set(sort);
    this.analytics.track('filter', { value: `sort:${sort}` });
    this.loading.set(true);
    this.load$.next({ reset: true });
  }

  onInstituteChange(event: Event) {
    const id = (event.target as HTMLSelectElement).value;
    this.instituteId.set(id);
    this.analytics.track('filter', { value: id ? 'institute' : 'institute:all' });
    this.departmentId.set('');
    this.departments.set([]);
    if (id) {
      this.api.getDepartments(id).subscribe(list =>
        this.departments.set([...list].sort((a, b) => a.longName.localeCompare(b.longName, 'uk'))));
    }
    this.reload();
  }

  onDepartmentChange(event: Event) {
    this.departmentId.set((event.target as HTMLSelectElement).value);
    this.analytics.track('filter', { value: this.departmentId() ? 'department' : 'department:all' });
    this.reload();
  }

  clearPlace() {
    this.instituteId.set('');
    this.departmentId.set('');
    this.departments.set([]);
    this.reload();
  }

  openTeacher(entry: LeaderboardEntry) {
    this.router.navigate(['/teacher', entry.id]);
  }

  departmentsLabel(entry: LeaderboardEntry): string {
    return entry.departments.map(d => d.shortName || d.longName).join(' · ');
  }

  metric(entry: LeaderboardEntry): string {
    switch (this.sort()) {
      case 'comments':
        return `${entry.numberOfComments}`;
      default:
        return `${entry.likes}`;
    }
  }

  metricIcon(): string {
    return this.sort() === 'comments' ? 'comment' : 'heart';
  }

  periodEmptyText(): string {
    if (this.search().trim()) return 'Нікого не знайшли. Спробуй інше ім’я або прізвище.';
    if (this.period() === 'today') return 'Сьогодні ще ніхто не голосував. Будь першим!';
    if (this.period() === 'week') return 'Цього тижня ще немає голосів.';
    return 'Тут поки порожньо.';
  }
}

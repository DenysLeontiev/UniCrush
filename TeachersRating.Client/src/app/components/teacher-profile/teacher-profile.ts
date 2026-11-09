import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { Location } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { LeaderboardService } from '../../services/leaderboard/leaderboard.service';
import { SelectionStore } from '../../services/selection/selection.store';
import { SheetsService } from '../../services/sheets/sheets.service';
import { AnalyticsService } from '../../services/analytics/analytics.service';
import { TeacherProfile as Profile } from '../../models/leaderboard.model';
import { InstituteRenamePipe } from '../../pipes/institute-rename/institute-rename-pipe';
import { Avatar } from '../../shared/avatar/avatar';

const WEEKDAYS = ['нд', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];

/** Full stats page for one teacher: /teacher/:id */
@Component({
  selector: 'app-teacher-profile',
  imports: [FontAwesomeModule, RouterLink, Avatar, InstituteRenamePipe],
  templateUrl: './teacher-profile.html',
})
export class TeacherProfile {
  private leaderboard = inject(LeaderboardService);
  private sheets = inject(SheetsService);
  private analytics = inject(AnalyticsService);
  private selection = inject(SelectionStore);
  private router = inject(Router);
  private location = inject(Location);
  private institutePipe = new InstituteRenamePipe();

  /** Bound from the route (:id). */
  readonly id = input.required<string>();

  readonly profile = signal<Profile | null>(null);
  readonly loading = signal(true);
  readonly notFound = signal(false);

  /** Share of likes among all votes, in %. */
  readonly sympathy = computed(() => {
    const p = this.profile();
    if (!p) return null;
    const total = p.likes + p.dislikes;
    return total === 0 ? null : Math.round((p.likes / total) * 100);
  });

  readonly totalVotes = computed(() => {
    const p = this.profile();
    return p ? p.likes + p.dislikes : 0;
  });

  /** Bars for the 14-day chart, scaled to the busiest day. */
  readonly bars = computed(() => {
    const days = this.profile()?.daily ?? [];
    const max = Math.max(1, ...days.map(d => d.likes + d.dislikes));
    return days.map((d, i) => {
      const date = new Date(`${d.date}T12:00:00`);
      return {
        ...d,
        likesPct: Math.round((d.likes / max) * 100),
        dislikesPct: Math.round((d.dislikes / max) * 100),
        label: WEEKDAYS[date.getDay()],
        isToday: i === days.length - 1,
        title: `${date.getDate()}.${String(date.getMonth() + 1).padStart(2, '0')}: ❤ ${d.likes} · 💔 ${d.dislikes}`,
      };
    });
  });

  readonly hasActivity = computed(() => (this.profile()?.daily ?? []).some(d => d.likes + d.dislikes > 0));

  readonly rankDepartment = computed(() => {
    const p = this.profile();
    return p?.departments.find(d => d.id === p.rankDepartmentId) ?? null;
  });

  constructor() {
    effect(() => {
      const id = this.id();
      untracked(() => this.load(id));
    });
  }

  private load(id: string) {
    this.loading.set(true);
    this.notFound.set(false);
    this.leaderboard.getTeacherProfile(id).subscribe({
      next: (profile) => {
        this.profile.set(profile);
        this.loading.set(false);
      },
      error: () => {
        this.notFound.set(true);
        this.loading.set(false);
      },
    });
  }

  trackOutbound(id: string) {
    this.analytics.track('outbound', { entityId: id, value: 'lpnu' });
  }

  back() {
    if (window.history.length > 1) this.location.back();
    else this.router.navigate(['/leaderboard']);
  }

  openComments() {
    const p = this.profile();
    if (!p) return;
    this.sheets.openTeacher({
      id: p.id,
      fullName: p.fullName,
      position: p.position,
      photoUrl: p.photoUrl,
      personalPageUrl: p.personalPageUrl,
      likes: p.likes,
      dislikes: p.dislikes,
      subtitle: p.departments.map(d => d.shortName || d.longName).join(' · '),
    }, { showProfileLink: false });
  }

  swipeDepartment(departmentId: string) {
    const department = this.profile()?.departments.find(d => d.id === departmentId);
    if (!department) return;

    this.selection.save({
      instituteId: department.instituteId,
      instituteName: this.institutePipe.transform(department.instituteName).trim(),
      departmentId: department.id,
      departmentName: department.longName,
      departmentShortName: department.shortName,
    });
    this.analytics.track('swipe_start', { entityId: department.id });
    this.router.navigate(['/comparison', department.id]);
  }

  plural(n: number, one: string, few: string, many: string): string {
    const mod10 = n % 10, mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return one;
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
    return many;
  }
}

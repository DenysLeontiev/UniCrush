import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { ApiService } from '../../services/api.service';
import { LeaderboardService } from '../../services/leaderboard/leaderboard.service';
import { SelectionStore } from '../../services/selection/selection.store';
import { SheetsService } from '../../services/sheets/sheets.service';
import { AnalyticsService } from '../../services/analytics/analytics.service';
import { Institute } from '../../models/institute.model';
import { Department } from '../../models/department.model';
import { TodaysCrush } from '../../models/leaderboard.model';
import { InstituteRenamePipe } from '../../pipes/institute-rename/institute-rename-pipe';
import { Avatar } from '../../shared/avatar/avatar';

@Component({
  selector: 'app-selection-form',
  standalone: true,
  imports: [FontAwesomeModule, RouterLink, InstituteRenamePipe, Avatar],
  templateUrl: './selection-form.component.html'
})
export class SelectionFormComponent implements OnInit {
  private apiService = inject(ApiService);
  private leaderboardService = inject(LeaderboardService);
  private router = inject(Router);
  readonly selection = inject(SelectionStore);
  readonly sheets = inject(SheetsService);
  private analytics = inject(AnalyticsService);

  private readonly institutePipe = new InstituteRenamePipe();

  institutes = signal<Institute[]>([]);
  departments = signal<Department[]>([]);
  selectedInstituteId = signal<string>('');
  selectedDepartmentId = signal<string>('');
  institutesLoading = signal(true);
  departmentsLoading = signal(false);
  error = signal<string>('');

  crush = signal<TodaysCrush | null>(null);
  crushLoading = signal(true);

  readonly canStart = computed(() => !!this.selectedDepartmentId() && !this.departmentsLoading());

  readonly todayLabel = new Intl.DateTimeFormat('uk-UA', { day: 'numeric', month: 'long' }).format(new Date());

  ngOnInit() {
    this.loadInstitutes();
    this.loadCrush();
  }

  private loadCrush() {
    this.leaderboardService.getTodaysCrush().subscribe({
      next: (crush) => {
        this.crush.set(crush);
        this.crushLoading.set(false);
      },
      error: () => this.crushLoading.set(false),
    });
  }

  private loadInstitutes() {
    this.institutesLoading.set(true);
    this.error.set('');

    this.apiService.getInstitutes().subscribe({
      next: (institutes) => {
        const sorted = [...institutes].sort((a, b) =>
          this.institutePipe.transform(a.name).localeCompare(this.institutePipe.transform(b.name), 'uk'));
        this.institutes.set(sorted);
        this.institutesLoading.set(false);

        // Pre-fill with the last used department.
        const last = this.selection.last();
        if (last && sorted.some(i => i.id === last.instituteId)) {
          this.selectInstitute(last.instituteId, last.departmentId);
        }
      },
      error: () => {
        this.error.set('Не вдалося завантажити інститути. Спробуй трохи пізніше.');
        this.institutesLoading.set(false);
      }
    });
  }

  private selectInstitute(instituteId: string, preselectDepartmentId = '') {
    this.selectedInstituteId.set(instituteId);
    this.selectedDepartmentId.set('');
    this.departments.set([]);

    if (!instituteId) return;

    this.departmentsLoading.set(true);
    this.apiService.getDepartments(instituteId).subscribe({
      next: (departments) => {
        const sorted = [...departments].sort((a, b) => a.longName.localeCompare(b.longName, 'uk'));
        this.departments.set(sorted);
        this.departmentsLoading.set(false);
        if (preselectDepartmentId && sorted.some(d => d.id === preselectDepartmentId)) {
          this.selectedDepartmentId.set(preselectDepartmentId);
        }
      },
      error: () => {
        this.error.set('Не вдалося завантажити кафедри. Спробуй трохи пізніше.');
        this.departmentsLoading.set(false);
      }
    });
  }

  onInstituteChange(event: Event) {
    this.selectInstitute((event.target as HTMLSelectElement).value);
  }

  onDepartmentChange(event: Event) {
    this.selectedDepartmentId.set((event.target as HTMLSelectElement).value);
  }

  startComparison() {
    const departmentId = this.selectedDepartmentId();
    const institute = this.institutes().find(i => i.id === this.selectedInstituteId());
    const department = this.departments().find(d => d.id === departmentId);
    if (!departmentId || !institute || !department) return;

    const instituteName = this.institutePipe.transform(institute.name).trim();
    this.selection.save({
      instituteId: institute.id,
      instituteName,
      departmentId,
      departmentName: department.longName,
      departmentShortName: department.shortName,
    });

    // Keep the legacy signals in sync for anything still reading them.
    this.apiService.lastSelectedInstituteName.set(instituteName);
    this.apiService.lastSelectedDepartmentName.set(department.longName);

    this.analytics.track('swipe_start', { entityId: departmentId });
    this.router.navigate(['/comparison', departmentId]);
  }

  openCrush() {
    const worker = this.crush()?.worker;
    if (worker) this.router.navigate(['/teacher', worker.id]);
  }

  likesWord(n: number): string {
    const mod10 = n % 10, mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return 'вподобання';
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'вподобання';
    return 'вподобань';
  }
}

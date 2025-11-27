import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { Institute } from '../../models/institute.model';
import { Department } from '../../models/department.model';
import { Worker } from '../../models/worker.model';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { InstituteRenamePipe } from "../../pipes/institute-rename/institute-rename-pipe";
import { MatBottomSheet, MatBottomSheetModule } from '@angular/material/bottom-sheet';
import { WorkerComments } from '../../modals/worker-comments/worker-comments';

@Component({
  selector: 'app-top-workers',
  imports: [CommonModule, FontAwesomeModule, RouterLink, InstituteRenamePipe],
  templateUrl: './top-workers.html',
  styleUrl: './top-workers.scss'
})
export class TopWorkers {
  private apiService = inject(ApiService);

  private commentsBottomSheet = inject(MatBottomSheet);

  institutes = signal<Institute[]>([]);
  departments = signal<Department[]>([]);
  workers = signal<Worker[]>([]);

  selectedInstitute = signal<Institute | null>(null);
  selectedDepartment = signal<Department | null>(null);

  institutesLoading = signal(false);
  departmentsLoading = signal(false);
  workersLoading = signal(false);

  ngOnInit() {
    this.loadInstitutes();
  }

  loadInstitutes() {
    this.institutesLoading.set(true);
    this.apiService.getInstitutes().subscribe({
      next: (data) => {
        this.institutes.set(data);
        this.institutesLoading.set(false);
      },
      error: () => this.institutesLoading.set(false)
    });
  }

  selectInstitute(institute: Institute) {
    this.selectedInstitute.set(institute);
    this.selectedDepartment.set(null);
    this.departments.set([]);
    this.workers.set([]);
    this.apiService.lastSelectedInstituteName.set(institute.name);

    this.departmentsLoading.set(true);
    this.apiService.getDepartments(institute.id).subscribe({
      next: (data) => {
        this.departments.set(data);
        this.departmentsLoading.set(false);
      },
      error: () => this.departmentsLoading.set(false)
    });
  }

  selectDepartment(department: Department) {
    this.selectedDepartment.set(department);
    this.workers.set([]);
    this.apiService.lastSelectedDepartmentName.set(department.shortName);

    this.workersLoading.set(true);
    this.apiService.getTopWorkersForDepartment(department.id).subscribe({
      next: (data) => {
        this.workers.set(data);
        this.workersLoading.set(false);
      },
      error: () => this.workersLoading.set(false)
    });
  }

  onInstituteChange(event: Event) {
    const select = event.target as HTMLSelectElement;
    const instituteId = select.value;

    if (!instituteId) {
      this.selectedInstitute.set(null);
      this.selectedDepartment.set(null);
      this.departments.set([]);
      this.workers.set([]);
      return;
    }

    const institute = this.institutes().find(i => i.id === instituteId);
    if (institute) {
      this.selectInstitute(institute);
    }
  }

  onDepartmentChange(event: Event) {
    const select = event.target as HTMLSelectElement;
    const departmentId = select.value;

    if (!departmentId) {
      this.selectedDepartment.set(null);
      this.workers.set([]);
      return;
    }

    const department = this.departments().find(d => d.id === departmentId);
    if (department) {
      this.selectDepartment(department);
    }
  }

  public openWorkerComments(workerId: string): void {
    this.commentsBottomSheet.open(WorkerComments, {
      data: {
        workerId: workerId
      }
    });
  }
}

import { Component, OnInit, signal, inject, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { Institute } from '../../models/institute.model';
import { Department } from '../../models/department.model';
import { InstituteRenamePipe } from "../../pipes/institute-rename/institute-rename-pipe";
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';

@Component({
  selector: 'app-selection-form',
  standalone: true,
  imports: [CommonModule, FontAwesomeModule, FormsModule, RouterLink, InstituteRenamePipe],
  templateUrl: './selection-form.component.html',
  styleUrl: './selection-form.component.scss'
})
export class SelectionFormComponent implements OnInit {
  private apiService = inject(ApiService);
  private router = inject(Router);

  institutes = signal<Institute[]>([]);
  departments = signal<Department[]>([]);
  selectedInstituteId = signal<string>('');
  selectedDepartmentId = signal<string>('');
  isLoading = signal(false);
  error = signal<string>('');

  departmentSelected = output<string>();

  ngOnInit() {
    this.loadInstitutes();
  }

  private loadInstitutes() {
    this.isLoading.set(true);
    this.error.set('');

    this.apiService.getInstitutes().subscribe({
      next: (institutes) => {
        this.institutes.set(institutes);
        this.isLoading.set(false);
      },
      error: (error) => {
        this.error.set('Сталася помилка під час завантаження інститутів. Бумб ласка, спробуйте пізніше.');
        this.isLoading.set(false);
        console.error('Error loading institutes:', error);
      }
    });
  }

  private loadDepartments(instituteId: string) {
    this.isLoading.set(true);
    this.error.set('');

    this.apiService.getDepartments(instituteId).subscribe({
      next: (departments) => {
        this.departments.set(departments);
        this.isLoading.set(false);
      },
      error: (error) => {
        this.error.set('Сталася помилка під час завантаження кафедр. Бумб ласка, спробуйте пізніше.');
        this.isLoading.set(false);
        console.error('Error loading departments:', error);
      }
    });
  }

  onDepartmentChange(event: Event) {
    const selectElement = event.target as HTMLSelectElement | null;
    if (!selectElement) return;
    const departmentId = selectElement.value;
    const departmentName = selectElement.options[selectElement.selectedIndex].text;

    this.selectedDepartmentId.set(departmentId);

    this.apiService.lastSelectedDepartmentName.set(departmentName);
  }

  onInstituteChange(event: Event) {
    const selectElement = event.target as HTMLSelectElement | null;
    if (!selectElement) return;
    const instituteId = selectElement.value;
    const instituteName = selectElement.options[selectElement.selectedIndex].text;

    this.selectedInstituteId.set(instituteId);
    this.selectedDepartmentId.set('');
    this.departments.set([]);

    this.apiService.lastSelectedInstituteName.set(instituteName)

    if (instituteId) {
      this.loadDepartments(instituteId);
    }
  }

  startComparison() {
    const departmentId = this.selectedDepartmentId();
    if (departmentId) {
      this.router.navigate(['/comparison', departmentId]);
    }
  }

  canStartComparison() {
    return this.selectedDepartmentId() && !this.isLoading();
  }
}
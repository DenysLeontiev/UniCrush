import { Injectable, computed, signal } from '@angular/core';

export interface DepartmentSelection {
  instituteId: string;
  instituteName: string;
  departmentId: string;
  departmentName: string;
  departmentShortName: string;
}

const STORAGE_KEY = 'uc-last-department';

/** Remembers the last chosen department so "Свайп" and "Продовжити" work after a reload. */
@Injectable({ providedIn: 'root' })
export class SelectionStore {
  readonly last = signal<DepartmentSelection | null>(this.read());

  readonly swipeLink = computed(() => {
    const last = this.last();
    return last ? ['/comparison', last.departmentId] : ['/home'];
  });

  save(selection: DepartmentSelection): void {
    this.last.set(selection);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(selection));
    } catch {
      /* ignore */
    }
  }

  private read(): DepartmentSelection | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as DepartmentSelection) : null;
    } catch {
      return null;
    }
  }
}

import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Observable, catchError, map, of, tap } from 'rxjs';
import { environment } from '../../../environments/environment.development';
import {
  AdminComment, DashboardBehavior, DashboardBreakdowns, DashboardEngagement, DashboardOnline, DashboardOverview,
  DashboardTimeseries, LiveSnapshot, OnlineGranularity,
} from '../../models/admin.model';
import { PaginatedList } from '../../models/pagination/paginatedList.model';

@Injectable({ providedIn: 'root' })
export class AdminService {
  private http = inject(HttpClient);
  private base = `${environment.baseUrl}/admin`;

  /** Logged-in admin username (null = not logged in / unknown). */
  readonly username = signal<string | null>(null);

  login(username: string, password: string): Observable<{ username: string }> {
    return this.http.post<{ username: string }>(`${this.base}/login`, { username, password }, { withCredentials: true })
      .pipe(tap(r => this.username.set(r.username)));
  }

  logout(): Observable<void> {
    return this.http.post<void>(`${this.base}/logout`, {}, { withCredentials: true })
      .pipe(tap(() => this.username.set(null)));
  }

  me(): Observable<boolean> {
    return this.http.get<{ username: string }>(`${this.base}/me`, { withCredentials: true }).pipe(
      tap(r => this.username.set(r.username)),
      map(() => true),
      catchError(() => {
        this.username.set(null);
        return of(false);
      }),
    );
  }

  overview(from: string, to: string) { return this.get<DashboardOverview>('dashboard/overview', { from, to }); }
  timeseries(from: string, to: string) { return this.get<DashboardTimeseries>('dashboard/timeseries', { from, to }); }
  breakdowns(from: string, to: string) { return this.get<DashboardBreakdowns>('dashboard/breakdowns', { from, to }); }
  engagement(from: string, to: string) { return this.get<DashboardEngagement>('dashboard/engagement', { from, to }); }
  live() { return this.get<LiveSnapshot>('dashboard/live', {}); }
  online(from: string, to: string, granularity: OnlineGranularity | null) {
    return this.get<DashboardOnline>('dashboard/online', { from, to, granularity: granularity ?? '' });
  }
  behavior(from: string, to: string) { return this.get<DashboardBehavior>('dashboard/behavior', { from, to }); }

  comments(query: { search?: string; status?: string; pageNumber: number; pageSize: number }) {
    return this.get<PaginatedList<AdminComment>>('comments', {
      search: query.search ?? '', status: query.status ?? 'all', pageNumber: query.pageNumber, pageSize: query.pageSize,
    });
  }

  hideComment(id: string) { return this.http.post<void>(`${this.base}/comments/${id}/hide`, {}, { withCredentials: true }); }
  restoreComment(id: string) { return this.http.post<void>(`${this.base}/comments/${id}/restore`, {}, { withCredentials: true }); }
  deleteComment(id: string) { return this.http.delete<void>(`${this.base}/comments/${id}`, { withCredentials: true }); }

  private get<T>(path: string, params: Record<string, string | number>): Observable<T> {
    let httpParams = new HttpParams();
    for (const [k, v] of Object.entries(params)) {
      if (v !== '' && v !== null && v !== undefined) httpParams = httpParams.set(k, v);
    }
    return this.http.get<T>(`${this.base}/${path}`, { params: httpParams, withCredentials: true });
  }
}

/** Route guard: only a logged-in admin may open the dashboard. */
export const adminGuard: CanActivateFn = () => {
  const admin = inject(AdminService);
  const router = inject(Router);
  return admin.me().pipe(map(ok => ok || router.createUrlTree(['/admin/login'])));
};

import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment.development';
import { LeaderboardEntry, LeaderboardQuery, TeacherProfile, TodaysCrush } from '../../models/leaderboard.model';
import { PaginatedList } from '../../models/pagination/paginatedList.model';

@Injectable({ providedIn: 'root' })
export class LeaderboardService {
  private http = inject(HttpClient);
  private baseUrl = environment.baseUrl;

  getLeaderboard(query: LeaderboardQuery): Observable<PaginatedList<LeaderboardEntry>> {
    let params = new HttpParams()
      .set('period', query.period)
      .set('sort', query.sort)
      .set('pageNumber', query.pageNumber)
      .set('pageSize', query.pageSize);

    if (query.search?.trim()) params = params.set('search', query.search.trim());
    if (query.departmentId) params = params.set('departmentId', query.departmentId);
    else if (query.instituteId) params = params.set('instituteId', query.instituteId);

    return this.http.get<PaginatedList<LeaderboardEntry>>(`${this.baseUrl}/leaderboard`, { params });
  }

  getTodaysCrush(instituteId?: string, departmentId?: string): Observable<TodaysCrush> {
    let params = new HttpParams();
    if (departmentId) params = params.set('departmentId', departmentId);
    else if (instituteId) params = params.set('instituteId', instituteId);

    return this.http.get<TodaysCrush>(`${this.baseUrl}/crush/today`, { params });
  }

  getTeacherProfile(workerId: string): Observable<TeacherProfile> {
    return this.http.get<TeacherProfile>(`${this.baseUrl}/workers/${workerId}/profile`);
  }
}

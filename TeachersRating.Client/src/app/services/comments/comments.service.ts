import { inject, Injectable } from '@angular/core';
import { environment } from '../../../environments/environment.development';
import { CommentsQueryParams } from '../../models/queryParams/commentsQueryParams.model';
import { HttpClient, HttpParams } from '@angular/common/http';
import { PaginatedList } from '../../models/pagination/paginatedList.model';
import { Comment } from '../../models/comment.model';
import { BehaviorSubject, Observable, take, tap } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class CommentsService {
  private baseUrl: string = environment.baseUrl;

  private commentsForWorkerSource: BehaviorSubject<Comment[]> = new BehaviorSubject<Comment[]>([]);
  public commentsForWorker$: Observable<Comment[]> = this.commentsForWorkerSource.asObservable();

  private http = inject(HttpClient);

  public getPaginatedComments(workerId: string, commentsQueryParams: CommentsQueryParams) {
    const params = new HttpParams()
      .set('PageNumber', commentsQueryParams.pageNumber)
      .set('PageSize', commentsQueryParams.pageSize);

    return this.http.get<PaginatedList<Comment>>(`${this.baseUrl}/comments/${workerId}`, { params }).pipe(
      take(1),
      tap(comments => {
        const currentComments = this.commentsForWorkerSource.getValue();
        const updatedComments = currentComments.concat(comments.items);
        this.commentsForWorkerSource.next(updatedComments);
      })
    );
  }
}

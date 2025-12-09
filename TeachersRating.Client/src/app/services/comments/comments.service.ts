import { inject, Injectable } from '@angular/core';
import { environment } from '../../../environments/environment.development';
import { CommentsQueryParams } from '../../models/queryParams/commentsQueryParams.model';
import { HttpClient, HttpParams } from '@angular/common/http';
import { PaginatedList } from '../../models/pagination/paginatedList.model';
import { Comment } from '../../models/comment.model';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { AddComment } from '../../models/add-comment.model';
import { CommentRepliesQueryParams } from '../../models/queryParams/commentRepliesQueryParams.model';

@Injectable({
  providedIn: 'root'
})
export class CommentsService {
  private baseUrl: string = environment.baseUrl;

  private commentsForWorkerSource: BehaviorSubject<PaginatedList<Comment> | null> = new BehaviorSubject<PaginatedList<Comment> | null>(null);
  public commentsForWorker$: Observable<PaginatedList<Comment> | null> = this.commentsForWorkerSource.asObservable();

  private repliesForCommentSource: BehaviorSubject<PaginatedList<Comment> | null> = new BehaviorSubject<PaginatedList<Comment> | null>(null);
  public repliesForComment$: Observable<PaginatedList<Comment> | null> = this.repliesForCommentSource.asObservable();

  private http = inject(HttpClient);

  public getCurrentComments(): PaginatedList<Comment> | null {
    return this.commentsForWorkerSource.getValue();
  }

  public getCurrentRepliesForComment(): PaginatedList<Comment> | null {
    return this.repliesForCommentSource.getValue();
  }

  public getPaginatedComments(workerId: string, commentsQueryParams: CommentsQueryParams): Observable<PaginatedList<Comment>> {
    const params = new HttpParams()
      .set('PageNumber', commentsQueryParams.pageNumber)
      .set('PageSize', commentsQueryParams.pageSize);

    return this.http.get<PaginatedList<Comment>>(`${this.baseUrl}/comments/${workerId}`, { params }).pipe(
      tap(response => {
        console.log("comments response: ", response);

        const current = this.commentsForWorkerSource.getValue();

        if (current && commentsQueryParams.pageNumber > 1) {
          // Append items for pagination
          const updatedItems = [...current.items, ...response.items];
          const updated: PaginatedList<Comment> = {
            ...response,
            items: updatedItems
          };
          this.commentsForWorkerSource.next(updated);
        } else {
          // First page or reset
          this.commentsForWorkerSource.next(response);
        }
      })
    );
  }

  public getPaginatedReplies(commentId: string, commentRepliesQueryParams: CommentRepliesQueryParams): Observable<PaginatedList<Comment>> {
    const params = new HttpParams()
      .set('PageNumber', commentRepliesQueryParams.pageNumber)
      .set('PageSize', commentRepliesQueryParams.pageSize);

    return this.http.get<PaginatedList<Comment>>(`${this.baseUrl}/comments/${commentId}/replies`, { params }).pipe(
      tap(response => {
        console.log("replies response: ", response);

        const current = this.repliesForCommentSource.getValue();

        if (current && commentRepliesQueryParams.pageNumber > 1) {
          const updatedItems = [...current.items, ...response.items];
          const updated: PaginatedList<Comment> = {
            ...response,
            items: updatedItems
          };
          this.repliesForCommentSource.next(updated);
        } else {
          this.repliesForCommentSource.next(response);
        }
      })
    );
  }

  public addComment(workerId: string, addComment: AddComment) {
    return this.http.post<Comment>(`${this.baseUrl}/comments/${workerId}`, addComment).pipe(tap(comment => {
      // Check if this is a reply to another comment
      if (addComment.parentCommentId) {
        // Update replies list
        const currentReplies = this.repliesForCommentSource.getValue();

        if (currentReplies && Array.isArray(currentReplies.items)) {
          // Update existing replies list
          const updatedItems = [comment, ...currentReplies.items];
          const updated: PaginatedList<Comment> = {
            ...currentReplies,
            items: updatedItems,
            totalCount: currentReplies.totalCount + 1
          };
          this.repliesForCommentSource.next(updated);
        } else {
          // Create new replies list if none exists
          const newList: PaginatedList<Comment> = {
            items: [comment],
            totalCount: 1,
            pageNumber: 1,
            pageSize: 10,
            totalPages: 1
          };
          this.repliesForCommentSource.next(newList);
        }

        // Update parent comment's numberOfReplies in main comments list
        const currentComments = this.commentsForWorkerSource.getValue();
        if (currentComments && Array.isArray(currentComments.items)) {
          const updatedComments = currentComments.items.map(c => 
            c.id === addComment.parentCommentId 
              ? { ...c, numberOfReplies: c.numberOfReplies + 1 }
              : c
          );
          const updated: PaginatedList<Comment> = {
            ...currentComments,
            items: updatedComments
          };
          this.commentsForWorkerSource.next(updated);
        }
      } else {
        // Update main comments list (original code)
        const current = this.commentsForWorkerSource.getValue();

        if (current && Array.isArray(current.items)) {
          // Update existing list
          const updatedItems = [comment, ...current.items];
          const updated: PaginatedList<Comment> = {
            ...current,
            items: updatedItems,
            totalCount: current.totalCount + 1
          };
          this.commentsForWorkerSource.next(updated);
        } else {
          // Create new list if none exists or items is not an array
          const newList: PaginatedList<Comment> = {
            items: [comment],
            totalCount: 1,
            pageNumber: 1,
            pageSize: 10,
            totalPages: 1
          };
          this.commentsForWorkerSource.next(newList);
        }
      }
    }));
  }

  public clearComments(): void {
    this.commentsForWorkerSource.next(null);
  }

  public clearReplies(): void {
    this.repliesForCommentSource.next(null);
  }
}

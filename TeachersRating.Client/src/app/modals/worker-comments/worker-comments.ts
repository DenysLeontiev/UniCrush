import { Component, inject, Inject, OnDestroy, OnInit, HostListener } from '@angular/core';
import { MAT_BOTTOM_SHEET_DATA, MatBottomSheetModule } from '@angular/material/bottom-sheet';
import { CommentsService } from '../../services/comments/comments.service';
import { CommentsQueryParams } from '../../models/queryParams/commentsQueryParams.model';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AddComment } from '../../models/add-comment.model';

@Component({
  selector: 'app-worker-comments',
  imports: [CommonModule, FormsModule],
  templateUrl: './worker-comments.html',
  styleUrl: './worker-comments.scss'
})
export class WorkerComments implements OnInit, OnDestroy {

  public commentsService = inject(CommentsService);
  public newCommentText: string = '';
  public isSubmitting: boolean = false;
  public isLoadingMore: boolean = false;

  private commentsQueryParams: CommentsQueryParams = new CommentsQueryParams();
  private canLoadMore: boolean = true;

  constructor(@Inject(MAT_BOTTOM_SHEET_DATA) public data: any) { }
  
  ngOnInit(): void {
    this.loadComments();
  }
  
  ngOnDestroy(): void {
    this.commentsService.clearComments();
  }

  @HostListener('scroll', ['$event'])
  onScroll(event: any): void {
    const element = event.target;
    const threshold = 100;
    const position = element.scrollTop + element.offsetHeight;
    const height = element.scrollHeight;

    if (position > height - threshold && !this.isLoadingMore && this.canLoadMore) {
      this.loadMoreComments();
    }
  }

  private loadComments(): void {
    const workerId: string = this.data.workerId;
    this.commentsService.getPaginatedComments(workerId, this.commentsQueryParams).subscribe({
      next: (response) => {
        console.log(response);
        this.updatePaginationState(response);
      },
      error: (error) => {
        console.log(error);
      }
    });
  }

  private loadMoreComments(): void {
    const currentComments = this.commentsService.getCurrentComments();
    
    if (!currentComments || currentComments.pageNumber >= currentComments.totalPages) {
      this.canLoadMore = false;
      return;
    }

    this.isLoadingMore = true;
    this.commentsQueryParams.pageNumber++;
    
    const workerId: string = this.data.workerId;
    this.commentsService.getPaginatedComments(workerId, this.commentsQueryParams).subscribe({
      next: (response) => {
        console.log('Loaded more comments:', response);
        this.updatePaginationState(response);
        this.isLoadingMore = false;
      },
      error: (error) => {
        console.error('Failed to load more comments:', error);
        this.isLoadingMore = false;
        this.commentsQueryParams.pageNumber--;
      }
    });
  }

  private updatePaginationState(response: any): void {
    this.canLoadMore = response.pageNumber < response.totalPages;
  }

  public onAddComment(): void {
    if (!this.newCommentText.trim() || this.isSubmitting) {
      return;
    }

    this.isSubmitting = true;
    const workerId: string = this.data.workerId;
    const addComment: AddComment = {
      content: this.newCommentText.trim()
    };

    this.commentsService.addComment(workerId, addComment).subscribe({
      next: (comment) => {
        console.log('Comment added:', comment);
        this.newCommentText = '';
        this.isSubmitting = false;
      },
      error: (error) => {
        console.error('Failed to add comment:', error);
        this.isSubmitting = false;
      }
    });
  }
}

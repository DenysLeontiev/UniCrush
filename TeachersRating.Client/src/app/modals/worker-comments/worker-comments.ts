import { Component, inject, Inject, OnDestroy, OnInit, HostListener } from '@angular/core';
import { MAT_BOTTOM_SHEET_DATA, MatBottomSheetModule } from '@angular/material/bottom-sheet';
import { CommentsService } from '../../services/comments/comments.service';
import { CommentsQueryParams } from '../../models/queryParams/commentsQueryParams.model';
import { CommentRepliesQueryParams } from '../../models/queryParams/commentRepliesQueryParams.model';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AddComment } from '../../models/add-comment.model';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { UkrainianDatePipe } from '../../pipes/date/ukrainian-date-pipe';

@Component({
  selector: 'app-worker-comments',
  imports: [CommonModule, FormsModule, FontAwesomeModule, UkrainianDatePipe],
  templateUrl: './worker-comments.html',
  styleUrl: './worker-comments.scss'
})
export class WorkerComments implements OnInit, OnDestroy {

  public commentsService = inject(CommentsService);
  public newCommentText: string = '';
  public isSubmitting: boolean = false;
  public isLoadingMore: boolean = false;
  public replyingToCommentId: string | null = null;
  public replyText: string = '';
  public isSubmittingReply: boolean = false;
  public expandedCommentIds: Set<string> = new Set();
  public repliesQueryParams: Map<string, CommentRepliesQueryParams> = new Map();
  public canLoadMoreReplies: Map<string, boolean> = new Map();
  public isLoadingMoreReplies: Map<string, boolean> = new Map();

  private commentsQueryParams: CommentsQueryParams = new CommentsQueryParams();
  private canLoadMore: boolean = true;

  constructor(@Inject(MAT_BOTTOM_SHEET_DATA) public data: any) { }

  ngOnInit(): void {
    this.loadComments();
  }
  
  ngOnDestroy(): void {
    this.commentsService.clearComments();
    this.commentsService.clearReplies();
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

  public onRespondClick(commentId: string): void {
    if (this.replyingToCommentId === commentId) {
      this.cancelReply();
    } else {
      this.replyingToCommentId = commentId;
      this.replyText = '';
    }
  }

  public cancelReply(): void {
    this.replyingToCommentId = null;
    this.replyText = '';
    this.isSubmittingReply = false;
  }

  public onSubmitReply(commentId: string): void {
    if (!this.replyText.trim() || this.isSubmittingReply) {
      return;
    }

    this.isSubmittingReply = true;
    const workerId: string = this.data.workerId;
    const addReply: AddComment = {
      content: this.replyText.trim(),
      parentCommentId: commentId
    };

    this.commentsService.addComment(workerId, addReply).subscribe({
      next: (reply) => {
        console.log('Reply added:', reply);
        this.replyText = '';
        this.isSubmittingReply = false;
        this.cancelReply();
      },
      error: (error) => {
        console.error('Failed to add reply:', error);
        this.isSubmittingReply = false;
      }
    });
  }

  public toggleReplies(commentId: string): void {
    if (this.expandedCommentIds.has(commentId)) {
      // Collapse replies
      this.expandedCommentIds.delete(commentId);
      this.commentsService.clearReplies();
    } else {
      // Expand and load replies
      this.expandedCommentIds.add(commentId);
      this.loadReplies(commentId);
    }
  }

  private loadReplies(commentId: string): void {
    if (!this.repliesQueryParams.has(commentId)) {
      this.repliesQueryParams.set(commentId, new CommentRepliesQueryParams());
    }

    const queryParams = this.repliesQueryParams.get(commentId)!;
    this.commentsService.getPaginatedReplies(commentId, queryParams).subscribe({
      next: (response) => {
        console.log('Replies loaded:', response);
        this.canLoadMoreReplies.set(commentId, response.pageNumber < response.totalPages);
      },
      error: (error) => {
        console.error('Failed to load replies:', error);
      }
    });
  }

  public loadMoreReplies(commentId: string, event: Event): void {
    event.stopPropagation();
    
    if (this.isLoadingMoreReplies.get(commentId)) {
      return;
    }

    const queryParams = this.repliesQueryParams.get(commentId);
    if (!queryParams) return;

    this.isLoadingMoreReplies.set(commentId, true);
    queryParams.pageNumber++;

    this.commentsService.getPaginatedReplies(commentId, queryParams).subscribe({
      next: (response) => {
        console.log('More replies loaded:', response);
        this.canLoadMoreReplies.set(commentId, response.pageNumber < response.totalPages);
        this.isLoadingMoreReplies.set(commentId, false);
      },
      error: (error) => {
        console.error('Failed to load more replies:', error);
        queryParams.pageNumber--;
        this.isLoadingMoreReplies.set(commentId, false);
      }
    });
  }

  public isRepliesExpanded(commentId: string): boolean {
    return this.expandedCommentIds.has(commentId);
  }
}

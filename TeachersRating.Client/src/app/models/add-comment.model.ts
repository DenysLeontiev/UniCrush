export interface AddComment {
    content: string;
    authorName?: string | null;
    parentCommentId?: string;
}
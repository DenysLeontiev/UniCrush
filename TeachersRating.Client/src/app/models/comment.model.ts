export interface Comment {
    id: string;
    dateCreated: Date;
    dateModified: Date;
    content: string;
    authorName?: string | null;
    workerId: string;
    numberOfReplies: number;
    parentCommentId?: string;
}
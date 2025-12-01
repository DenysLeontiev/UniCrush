export interface Comment {
    id: string;
    dateCreated: Date;
    dateModified: Date;
    content: string;
    workerId: string;
    numberOfReplies: number;
    parentCommentId?: string;
}
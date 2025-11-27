export interface Comment {
    id: string;
    dateCreated: Date;
    dateModified: Date;
    content: string;
    workerId: string;
    parentCommentId?: string;
}
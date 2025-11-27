export class CommentsQueryParams {
    public pageNumber: number = 1;
    public pageSize: number = 10;

    public constructor(pageNumber: number = 1, pageSize: number = 10) {
        this.pageNumber = pageNumber;
        this.pageSize = pageSize;
    }
}
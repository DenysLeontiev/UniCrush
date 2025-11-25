export class CommentsQueryParams {
    public pageNumber: number = 1;
    public pageSize: number = 10;

    public constructor(pageNumber: number, pageSize: number) {
        this.pageNumber = pageNumber;
        this.pageSize = pageSize;
    }
}
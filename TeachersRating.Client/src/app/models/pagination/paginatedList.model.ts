export interface PaginatedList<T> {
    pageNumber: number;
    totalPages: number;
    pageSize: number;
    totalCount: number;
    items: T[];
}
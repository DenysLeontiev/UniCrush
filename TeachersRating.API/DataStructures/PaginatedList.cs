using Microsoft.EntityFrameworkCore;

namespace TeachersRating.API.DataStructures;

public class PaginatedList<T> : List<T>
{
    public int PageNumber { get; private set; }
    public int TotalPages { get; private set; }
    public int PageSize { get; private set; }
    public int TotalCount { get; private set; }

    private PaginatedList(List<T> items, int count, int pageNumber, int pageSize)
    {
        PageNumber = pageNumber;
        TotalPages = (int)Math.Ceiling(count / (double)pageSize);
        PageSize = pageSize;
        AddRange(items);
    }

    public static async Task<PaginatedList<T>> CreateAsync(IQueryable<T> source, int pageIndex, int pageSize)
    {
        int count = await source.CountAsync();

        int skipAmount = (pageIndex - 1) * pageSize;
        var items = await source.Skip(skipAmount).Take(pageSize).ToListAsync();
        return new PaginatedList<T>(items, count, pageIndex, pageSize);
    }
}
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TeachersRating.API.Data;
using TeachersRating.API.DataStructures;
using TeachersRating.API.Extensions;
using TeachersRating.API.Interfaces;
using TeachersRating.API.Pagination;

namespace TeachersRating.API.Endpoints.Comment.Query.GetCommentsForWorkerById;

public class GetCommentsForWorkerById : IEndpoint
{
    public void MapEndpoint(IEndpointRouteBuilder app)
    {
        app.MapGet("/comments/{workerId:guid}", async (
            [FromRoute] Guid workerId,
            [AsParameters] CommentsQueryParams commentsQueryParams,
            [FromServices] AppDbContext context) =>
        {

            var worker = await context.Workers.AsNoTracking().FirstOrDefaultAsync(x => x.Id == workerId);

            if (worker is null)
            {
                return Results.BadRequest("Worker is not found.");
            }

            int skipAmount = (commentsQueryParams.PageNumber - 1) * commentsQueryParams.PageSize;

            var query = context.Comments
                .Where(x => x.WorkerId == workerId)
                .AsNoTracking();

            var pagedComments = await PaginatedList<Entities.Comment>.CreateAsync(
                query,
                commentsQueryParams.PageNumber,
                commentsQueryParams.PageSize);

            var mappedPagedComents = pagedComments.Select(x => x.ToDto());

            return Results.Ok(mappedPagedComents);
        });
    }
}
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TeachersRating.API.Data;
using TeachersRating.API.DataStructures;
using TeachersRating.API.DTOs;
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

            var worker = await context.Workers
                .AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == workerId);

            if (worker is null)
            {
                return Results.BadRequest("Worker is not found.");
            }

            var query = context.Comments
                .Where(x => x.WorkerId == workerId)
                .Where(x => x.ParentCommentId == null)
                .Include(x => x.Replies)
                .OrderByDescending(x => x.DateCreated)
                .AsNoTracking();

            var pagedComments = await PaginatedList<Entities.Comment>.CreateAsync(
                query,
                commentsQueryParams.PageNumber,
                commentsQueryParams.PageSize);

            var mappedPagedComments = new PaginatedList<CommentDto>(
                pagedComments.Items.Select(x => x.ToDto()).ToList(),
                pagedComments.TotalCount,
                pagedComments.PageNumber,
                pagedComments.PageSize
            );

            return Results.Ok(mappedPagedComments);
        });
    }
}
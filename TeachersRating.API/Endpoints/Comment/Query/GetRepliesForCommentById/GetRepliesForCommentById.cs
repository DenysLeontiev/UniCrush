using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TeachersRating.API.Data;
using TeachersRating.API.DataStructures;
using TeachersRating.API.DTOs;
using TeachersRating.API.Extensions;
using TeachersRating.API.Interfaces;
using TeachersRating.API.Pagination;

namespace TeachersRating.API.Endpoints.Comment.Query.GetRepliesForCommentById;

public class GetRepliesForCommentById : IEndpoint
{
    public void MapEndpoint(IEndpointRouteBuilder app)
    {
        app.MapGet("/comments/{commentId:guid}/replies", async (
            [FromRoute] Guid commentId,
            [AsParameters] CommentsQueryParams commentsQueryParams,
            [FromServices] AppDbContext context) =>
        {
            var query = context.Comments.Where(x => x.ParentCommentId == commentId)
                                        .OrderByDescending(x => x.DateCreated)
                                        .AsNoTracking();
            var pagedReplies = await PaginatedList<Entities.Comment>.CreateAsync(
                query,
                commentsQueryParams.PageNumber,
                commentsQueryParams.PageSize);     

            var mappedPagedReplies = new PaginatedList<CommentDto>(
                pagedReplies.Items.Select(x => x.ToDto()).ToList(),
                pagedReplies.TotalCount,
                pagedReplies.PageNumber,
                pagedReplies.PageSize
            );

            return Results.Ok(mappedPagedReplies);                       
        });
    }
}
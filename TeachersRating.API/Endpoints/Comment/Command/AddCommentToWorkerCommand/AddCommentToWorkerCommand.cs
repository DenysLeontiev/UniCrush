using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TeachersRating.API.Data;
using TeachersRating.API.Extensions;
using TeachersRating.API.Interfaces;

namespace TeachersRating.API.Endpoints.Comment.Command.AddCommentToWorkerCommand;

public class AddCommentToWorkerCommand : IEndpoint
{
    public void MapEndpoint(IEndpointRouteBuilder app)
    {
        app.MapPost("comments/{workerId:guid}", async ([FromRoute] Guid workerId, [FromBody] AddCommentDto addCommentDto, [FromServices] AppDbContext context) =>
        {
            string content = addCommentDto.Content?.Trim() ?? string.Empty;

            if (content.Length == 0)
            {
                return Results.BadRequest("Comment is empty.");
            }

            if (content.Length > 1000)
            {
                return Results.BadRequest("Comment is too long (max 1000 characters).");
            }

            // Forum-style optional name; whitespace-only -> anonymous.
            string? authorName = string.Join(' ', (addCommentDto.AuthorName ?? string.Empty)
                .Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries));

            if (authorName.Length == 0)
            {
                authorName = null;
            }
            else if (authorName.Length > 40)
            {
                return Results.BadRequest("Name is too long (max 40 characters).");
            }

            var worker = await context.Workers.FirstOrDefaultAsync(x => x.Id.Equals(workerId));

            if (worker is null)
            {
                return Results.NotFound("Worker not found.");
            }

            if (addCommentDto.ParentCommentId is not null)
            {
                var parentComment = await context.Comments
                    .FirstOrDefaultAsync(c => c.Id == addCommentDto.ParentCommentId && c.WorkerId == workerId);

                if (parentComment is null)
                    return Results.BadRequest("Parent comment does not exist or does not belong to this worker.");
            }

            var commentToAdd = new Entities.Comment
            {
                Content = content,
                AuthorName = authorName,
                WorkerId = workerId,
                ParentCommentId = addCommentDto.ParentCommentId,
            };

            await context.Comments.AddAsync(commentToAdd);

            await context.SaveChangesAsync();

            var mappedComment = commentToAdd.ToDto();

            return Results.Ok(mappedComment);
        });
    }
}
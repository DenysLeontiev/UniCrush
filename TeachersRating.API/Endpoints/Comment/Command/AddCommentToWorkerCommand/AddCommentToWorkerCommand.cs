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
            var worker = await context.Workers.Include(x => x.Comments).FirstOrDefaultAsync(x => x.Id.Equals(workerId));

            if (worker is null)
            {
                return Results.NotFound("Worker not found.");
            }

            if (addCommentDto.ParentCommentId is not null)
            {
                var parentExists = await context.Comments
                    .AnyAsync(c => c.Id == addCommentDto.ParentCommentId && c.WorkerId == workerId);

                if (!parentExists)
                    return Results.BadRequest("Parent comment does not exist or does not belong to this worker.");
            }

            var commentToAdd = new Entities.Comment
            {
                Content = addCommentDto.Content,
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
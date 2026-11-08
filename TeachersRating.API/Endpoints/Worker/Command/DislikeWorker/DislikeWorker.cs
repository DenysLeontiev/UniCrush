using Microsoft.AspNetCore.Mvc;
using TeachersRating.API.Data;
using TeachersRating.API.Endpoints.Worker.Command.LikeWorker;
using TeachersRating.API.Interfaces;

namespace TeachersRating.API.Endpoints.Worker.Command.DislikeWorker;

public class DislikeWorker : IEndpoint
{
    public void MapEndpoint(IEndpointRouteBuilder app)
    {
        app.MapPost("worker/{workerId:guid}/dislike", (Guid workerId, [FromServices] AppDbContext context)
            => WorkerVoting.VoteAsync(context, workerId, isLike: false));
    }
}

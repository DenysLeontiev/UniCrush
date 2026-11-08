using Microsoft.AspNetCore.Mvc;
using TeachersRating.API.Data;
using TeachersRating.API.Interfaces;

namespace TeachersRating.API.Endpoints.Worker.Command.LikeWorker;

public class LikeWorker : IEndpoint
{
    public void MapEndpoint(IEndpointRouteBuilder app)
    {
        app.MapPost("worker/{workerId:guid}/like", (Guid workerId, [FromServices] AppDbContext context)
            => WorkerVoting.VoteAsync(context, workerId, isLike: true));
    }
}

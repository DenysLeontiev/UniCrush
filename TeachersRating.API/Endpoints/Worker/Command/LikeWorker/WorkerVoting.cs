using Microsoft.EntityFrameworkCore;
using TeachersRating.API.Data;
using TeachersRating.API.Entities;
using TeachersRating.API.Extensions;

namespace TeachersRating.API.Endpoints.Worker.Command.LikeWorker;

public static class WorkerVoting
{
    public static async Task<IResult> VoteAsync(AppDbContext context, Guid workerId, bool isLike)
    {
        // Atomic increment in SQL, so concurrent votes are never lost.
        int updated = isLike
            ? await context.Workers.Where(w => w.Id == workerId)
                .ExecuteUpdateAsync(s => s.SetProperty(w => w.NumberOfLikes, w => w.NumberOfLikes + 1))
            : await context.Workers.Where(w => w.Id == workerId)
                .ExecuteUpdateAsync(s => s.SetProperty(w => w.NumberOfDislikes, w => w.NumberOfDislikes + 1));

        if (updated == 0)
        {
            return Results.NotFound("Worker not found.");
        }

        context.WorkerVotes.Add(new WorkerVote { WorkerId = workerId, IsLike = isLike });
        await context.SaveChangesAsync();

        var worker = await context.Workers
            .AsNoTracking()
            .Include(x => x.Photo)
            .FirstAsync(x => x.Id == workerId);

        return Results.Ok(worker.ToDto());
    }
}

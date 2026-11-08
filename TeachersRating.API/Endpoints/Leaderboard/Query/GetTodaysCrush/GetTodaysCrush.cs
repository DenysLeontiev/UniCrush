using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TeachersRating.API.Data;
using TeachersRating.API.DTOs;
using TeachersRating.API.Interfaces;
using TeachersRating.API.Services;

namespace TeachersRating.API.Endpoints.Leaderboard.Query.GetTodaysCrush;

/// <summary>
/// "Краш дня": the teacher with the most likes since local (Kyiv) midnight.
/// Ties go to whoever reached that number first.
/// </summary>
public class GetTodaysCrush : IEndpoint
{
    public void MapEndpoint(IEndpointRouteBuilder app)
    {
        app.MapGet("crush/today", async (
            [FromQuery] Guid? instituteId,
            [FromQuery] Guid? departmentId,
            [FromServices] AppDbContext context,
            [FromServices] AppCalendar calendar) =>
        {
            var fromUtc = calendar.StartOfDayUtc();

            var workerIds = LeaderboardQueries
                .FilterByPlace(context.Workers.AsNoTracking(), instituteId, departmentId)
                .Select(w => w.Id);

            var todaysLikes = context.WorkerVotes
                .AsNoTracking()
                .Where(v => v.IsLike && v.DateCreated >= fromUtc && workerIds.Contains(v.WorkerId));

            var top = await todaysLikes
                .GroupBy(v => v.WorkerId)
                .Select(g => new { WorkerId = g.Key, Likes = g.LongCount(), LastLikeAt = g.Max(v => v.DateCreated) })
                .OrderByDescending(x => x.Likes)
                .ThenBy(x => x.LastLikeAt)
                .FirstOrDefaultAsync();

            var result = new TodaysCrushDto
            {
                Date = calendar.Today.ToString("yyyy-MM-dd"),
                TotalLikesToday = await todaysLikes.LongCountAsync(),
            };

            if (top is not null)
            {
                var details = await LeaderboardQueries.LoadDetailsAsync(context, [top.WorkerId]);

                if (details.TryGetValue(top.WorkerId, out var entry))
                {
                    entry.Rank = 1;
                    entry.Likes = top.Likes;
                    entry.Dislikes = await context.WorkerVotes
                        .LongCountAsync(v => !v.IsLike && v.DateCreated >= fromUtc && v.WorkerId == top.WorkerId);
                    result.Worker = entry;
                }
            }

            return Results.Ok(result);
        }).WithName("GetTodaysCrush");
    }
}

using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TeachersRating.API.Data;
using TeachersRating.API.DTOs;
using TeachersRating.API.Endpoints.Leaderboard;
using TeachersRating.API.Interfaces;
using TeachersRating.API.Services;

namespace TeachersRating.API.Endpoints.Worker.Query.GetWorkerProfile;

public class WorkerProfileDto
{
    public Guid Id { get; set; }
    public string FullName { get; set; } = string.Empty;
    public string Position { get; set; } = string.Empty;
    public string PersonalPageUrl { get; set; } = string.Empty;
    public string PhotoUrl { get; set; } = string.Empty;
    public List<LeaderboardDepartmentDto> Departments { get; set; } = new();

    // all-time
    public long Likes { get; set; }
    public long Dislikes { get; set; }
    public int NumberOfComments { get; set; }

    // recent (Kyiv calendar days)
    public long LikesToday { get; set; }
    public long DislikesToday { get; set; }
    public long LikesWeek { get; set; }
    public long DislikesWeek { get; set; }

    // standing (by all-time likes)
    public int RankOverall { get; set; }
    public int TotalTeachers { get; set; }
    public int? RankInDepartment { get; set; }
    public int? DepartmentSize { get; set; }
    public Guid? RankDepartmentId { get; set; }

    /// <summary>How many days this teacher got the most likes of all teachers.</summary>
    public int CrushDays { get; set; }

    /// <summary>Last 14 days, oldest first.</summary>
    public List<DailyVotesDto> Daily { get; set; } = new();
}

public class DailyVotesDto
{
    public string Date { get; set; } = string.Empty;
    public int Likes { get; set; }
    public int Dislikes { get; set; }
}

public class GetWorkerProfile : IEndpoint
{
    private const int DailyDays = 14;

    public void MapEndpoint(IEndpointRouteBuilder app)
    {
        app.MapGet("workers/{workerId:guid}/profile", async (
            Guid workerId,
            [FromServices] AppDbContext context,
            [FromServices] AppCalendar calendar,
            [FromServices] IConfiguration configuration) =>
        {
            var details = await LeaderboardQueries.LoadDetailsAsync(context, [workerId]);

            if (!details.TryGetValue(workerId, out var entry))
            {
                return Results.NotFound("Worker not found.");
            }

            var counters = await context.Workers
                .AsNoTracking()
                .Where(w => w.Id == workerId)
                .Select(w => new { Likes = (long)w.NumberOfLikes, Dislikes = (long)w.NumberOfDislikes })
                .FirstAsync();

            var profile = new WorkerProfileDto
            {
                Id = entry.Id,
                FullName = entry.FullName,
                Position = entry.Position,
                PersonalPageUrl = entry.PersonalPageUrl,
                PhotoUrl = entry.PhotoUrl,
                Departments = entry.Departments,
                NumberOfComments = entry.NumberOfComments,
                Likes = counters.Likes,
                Dislikes = counters.Dislikes,
            };

            // Recent votes of this teacher (small: one teacher, 14 days) — grouped by Kyiv day in memory.
            var dailyFromUtc = calendar.StartOfDayUtc(daysAgo: DailyDays - 1);
            var recentVotes = await context.WorkerVotes
                .AsNoTracking()
                .Where(v => v.WorkerId == workerId && v.DateCreated >= dailyFromUtc)
                .Select(v => new { v.DateCreated, v.IsLike })
                .ToListAsync();

            var todayUtc = calendar.StartOfDayUtc();
            var weekUtc = calendar.StartOfDayUtc(daysAgo: 6);

            profile.LikesToday = recentVotes.LongCount(v => v.IsLike && v.DateCreated >= todayUtc);
            profile.DislikesToday = recentVotes.LongCount(v => !v.IsLike && v.DateCreated >= todayUtc);
            profile.LikesWeek = recentVotes.LongCount(v => v.IsLike && v.DateCreated >= weekUtc);
            profile.DislikesWeek = recentVotes.LongCount(v => !v.IsLike && v.DateCreated >= weekUtc);

            var byDay = recentVotes
                .GroupBy(v => calendar.ToLocalDate(v.DateCreated))
                .ToDictionary(g => g.Key, g => (Likes: g.Count(v => v.IsLike), Dislikes: g.Count(v => !v.IsLike)));

            for (int daysAgo = DailyDays - 1; daysAgo >= 0; daysAgo--)
            {
                var day = calendar.Today.AddDays(-daysAgo);
                byDay.TryGetValue(day, out var counts);
                profile.Daily.Add(new DailyVotesDto
                {
                    Date = day.ToString("yyyy-MM-dd"),
                    Likes = counts.Likes,
                    Dislikes = counts.Dislikes,
                });
            }

            // Rank by all-time likes (ties share the better place).
            var myLikes = (uint)counters.Likes;
            profile.TotalTeachers = await context.Workers.CountAsync();
            profile.RankOverall = 1 + await context.Workers.CountAsync(w => w.NumberOfLikes > myLikes);

            var rankDepartment = entry.Departments.FirstOrDefault();
            if (rankDepartment is not null)
            {
                var departmentWorkers = context.Workers.Where(w => w.Departments.Any(d => d.Id == rankDepartment.Id));
                profile.RankDepartmentId = rankDepartment.Id;
                profile.DepartmentSize = await departmentWorkers.CountAsync();
                profile.RankInDepartment = 1 + await departmentWorkers.CountAsync(w => w.NumberOfLikes > myLikes);
            }

            // Days on which this teacher had the most likes (Kyiv calendar), computed in Postgres.
            string timeZone = configuration["TimeZone"] ?? "Europe/Kyiv";
            profile.CrushDays = await context.Database
                .SqlQuery<int>($"""
                    SELECT COUNT(*)::int AS "Value"
                    FROM (
                        SELECT "WorkerId",
                               RANK() OVER (PARTITION BY day ORDER BY likes DESC) AS place
                        FROM (
                            SELECT ("DateCreated" AT TIME ZONE {timeZone})::date AS day,
                                   "WorkerId",
                                   COUNT(*) AS likes
                            FROM "WorkerVotes"
                            WHERE "IsLike"
                            GROUP BY 1, 2
                        ) per_day
                    ) ranked
                    WHERE place = 1 AND "WorkerId" = {workerId}
                    """)
                .SingleAsync();

            return Results.Ok(profile);
        }).WithName("GetWorkerProfile");
    }
}

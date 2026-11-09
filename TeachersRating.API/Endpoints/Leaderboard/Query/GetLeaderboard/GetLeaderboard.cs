using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TeachersRating.API.Data;
using TeachersRating.API.DataStructures;
using TeachersRating.API.DTOs;
using TeachersRating.API.Interfaces;
using TeachersRating.API.Services;

namespace TeachersRating.API.Endpoints.Leaderboard.Query.GetLeaderboard;

public class LeaderboardQueryParams
{
    public string? Search { get; set; }
    public Guid? InstituteId { get; set; }
    public Guid? DepartmentId { get; set; }

    /// <summary>all | week | today</summary>
    public string? Period { get; set; }

    /// <summary>likes | comments</summary>
    public string? Sort { get; set; }

    // Nullable so minimal APIs treat them as optional.
    public int? PageNumber { get; set; }
    public int? PageSize { get; set; }
}

public class GetLeaderboard : IEndpoint
{
    private sealed class ScoredWorker
    {
        public Guid Id { get; set; }
        public string FullName { get; set; } = string.Empty;
        public long Likes { get; set; }
        public long Dislikes { get; set; }
        public int Comments { get; set; }
    }

    public void MapEndpoint(IEndpointRouteBuilder app)
    {
        app.MapGet("leaderboard", async (
            [AsParameters] LeaderboardQueryParams query,
            [FromServices] AppDbContext context,
            [FromServices] AppCalendar calendar) =>
        {
            int pageNumber = Math.Max(1, query.PageNumber ?? 1);
            int pageSize = Math.Clamp(query.PageSize ?? 20, 1, 50);

            var workers = LeaderboardQueries.FilterByPlace(context.Workers.AsNoTracking(), query.InstituteId, query.DepartmentId);

            if (!string.IsNullOrWhiteSpace(query.Search))
            {
                string pattern = $"%{EscapeLike(query.Search.Trim())}%";
                workers = workers.Where(w => EF.Functions.ILike(w.FullName, pattern, "\\"));
            }

            DateTime? from = query.Period?.ToLowerInvariant() switch
            {
                "today" => calendar.StartOfDayUtc(),
                "week" => calendar.StartOfDayUtc(daysAgo: 6),
                _ => null,
            };

            IQueryable<ScoredWorker> scored;

            if (from is DateTime fromUtc)
            {
                scored = workers
                    .Select(w => new ScoredWorker
                    {
                        Id = w.Id,
                        FullName = w.FullName,
                        Likes = w.Votes.LongCount(v => v.IsLike && v.DateCreated >= fromUtc),
                        Dislikes = w.Votes.LongCount(v => !v.IsLike && v.DateCreated >= fromUtc),
                        Comments = w.Comments.Count(c => !c.IsDeleted),
                    })
                    // For a period, only teachers that actually got votes in it.
                    .Where(x => x.Likes + x.Dislikes > 0);
            }
            else
            {
                scored = workers.Select(w => new ScoredWorker
                {
                    Id = w.Id,
                    FullName = w.FullName,
                    Likes = (long)w.NumberOfLikes,
                    Dislikes = (long)w.NumberOfDislikes,
                    Comments = w.Comments.Count(c => !c.IsDeleted),
                });
            }

            scored = query.Sort?.ToLowerInvariant() switch
            {
                "comments" => scored.OrderByDescending(x => x.Comments).ThenByDescending(x => x.Likes).ThenBy(x => x.FullName),
                _ => scored.OrderByDescending(x => x.Likes).ThenBy(x => x.Dislikes).ThenBy(x => x.FullName),
            };

            int totalCount = await scored.CountAsync();

            int skip = (pageNumber - 1) * pageSize;
            var page = await scored.Skip(skip).Take(pageSize).ToListAsync();

            var details = await LeaderboardQueries.LoadDetailsAsync(context, page.Select(x => x.Id).ToList());

            var items = page
                .Select((x, index) =>
                {
                    var entry = details.GetValueOrDefault(x.Id) ?? new LeaderboardEntryDto { Id = x.Id, FullName = x.FullName };
                    entry.Rank = skip + index + 1;
                    entry.Likes = x.Likes;
                    entry.Dislikes = x.Dislikes;
                    entry.NumberOfComments = x.Comments;
                    return entry;
                })
                .ToList();

            return Results.Ok(new PaginatedList<LeaderboardEntryDto>(items, totalCount, pageNumber, pageSize));
        }).WithName("GetLeaderboard");
    }

    private static string EscapeLike(string value) =>
        value.Replace("\\", "\\\\").Replace("%", "\\%").Replace("_", "\\_");
}

using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TeachersRating.API.Data;
using TeachersRating.API.Interfaces;
using TeachersRating.API.Services;

namespace TeachersRating.API.Endpoints.Admin.Dashboard;

public class EngagementTimeRow
{
    public long TotalSeconds { get; set; }
    public int Visitors { get; set; }
    public int Sessions { get; set; }
}

public class PerfRow
{
    public string Key { get; set; } = string.Empty;
    public double Median { get; set; }
    public double P75 { get; set; }
    public int Samples { get; set; }
}

/// <summary>
/// Finer behaviour: real time on site (heartbeats), how people vote, skips, leaderboard filters,
/// scroll depth, opened comments, outbound clicks, theme switches, errors and load speed.
/// </summary>
public class BehaviorEndpoints : IEndpoint
{
    public void MapEndpoint(IEndpointRouteBuilder app)
    {
        app.MapGet("admin/dashboard/behavior", async (string? from, string? to,
            [FromServices] AppDbContext db, [FromServices] AppCalendar calendar) =>
        {
            var range = DashboardRange.Parse(from, to, calendar);
            var events = db.AnalyticsEvents.AsNoTracking()
                .Where(e => e.OccurredAt >= range.FromUtc && e.OccurredAt < range.ToUtcExclusive);

            async Task<List<CountRow>> ByValue(string type, string fallback = "—") => await events
                .Where(e => e.Type == type)
                .GroupBy(e => e.Value ?? fallback)
                .Select(g => new CountRow { Key = g.Key, Count = g.Count(), Count2 = g.Select(e => e.VisitorId).Distinct().Count() })
                .OrderByDescending(x => x.Count)
                .Take(30)
                .ToListAsync();

            // Heartbeats carry the visible seconds since the previous one.
            var time = (await db.Database.SqlQuery<EngagementTimeRow>($"""
                SELECT coalesce(sum(CASE WHEN "Value" ~ '^[0-9]+$' AND length("Value") <= 4 THEN "Value"::int ELSE 0 END), 0)::bigint AS "TotalSeconds",
                       count(DISTINCT "VisitorId")::int AS "Visitors",
                       count(DISTINCT "SessionId")::int AS "Sessions"
                FROM "AnalyticsEvents"
                WHERE "Type" = 'engage' AND "OccurredAt" >= {range.FromUtc} AND "OccurredAt" < {range.ToUtcExclusive}
                """).ToListAsync())[0];

            var allVisitors = await events.Select(e => e.VisitorId).Distinct().CountAsync();

            var timeByPage = await db.Database.SqlQuery<BreakdownRow>($"""
                SELECT "Page" AS "Key",
                       count(DISTINCT "VisitorId")::int AS "Visitors",
                       coalesce(sum(CASE WHEN "Value" ~ '^[0-9]+$' AND length("Value") <= 4 THEN "Value"::int ELSE 0 END), 0)::int AS "Pageviews"
                FROM "AnalyticsEvents"
                WHERE "Type" = 'engage' AND "OccurredAt" >= {range.FromUtc} AND "OccurredAt" < {range.ToUtcExclusive}
                GROUP BY 1 ORDER BY 3 DESC
                """).ToListAsync();

            var perfByDevice = await db.Database.SqlQuery<PerfRow>($"""
                SELECT "Device" AS "Key",
                       percentile_cont(0.5) WITHIN GROUP (ORDER BY "Value"::int)::float8 AS "Median",
                       percentile_cont(0.75) WITHIN GROUP (ORDER BY "Value"::int)::float8 AS "P75",
                       count(*)::int AS "Samples"
                FROM "AnalyticsEvents"
                WHERE "Type" = 'perf' AND "Value" ~ '^[0-9]+$' AND length("Value") <= 6
                  AND "OccurredAt" >= {range.FromUtc} AND "OccurredAt" < {range.ToUtcExclusive}
                GROUP BY 1 ORDER BY 4 DESC
                """).ToListAsync();

            int votes = await events.CountAsync(e => e.Type == "vote");
            int skips = await events.CountAsync(e => e.Type == "skip");

            return Results.Ok(new
            {
                engagedSeconds = time.TotalSeconds,
                avgSecondsPerVisitor = allVisitors > 0 ? Math.Round(time.TotalSeconds / (double)allVisitors, 1) : 0,
                avgSecondsPerSession = time.Sessions > 0 ? Math.Round(time.TotalSeconds / (double)time.Sessions, 1) : 0,
                timeByPage,
                voteMethods = await ByValue("vote", "unknown"),
                votes,
                skips,
                skipRate = votes + skips > 0 ? Math.Round(skips / (double)(votes + skips), 3) : 0,
                filters = await ByValue("filter"),
                loadMore = await ByValue("load_more"),
                openComments = await ByValue("open_comments"),
                outbound = await ByValue("outbound"),
                themeToggles = await ByValue("theme"),
                errors = await ByValue("error"),
                perfByDevice,
            });
        }).RequireAuthorization("Admin");
    }
}

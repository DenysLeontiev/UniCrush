using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TeachersRating.API.Data;
using TeachersRating.API.Hubs;
using TeachersRating.API.Interfaces;
using TeachersRating.API.Services;

namespace TeachersRating.API.Endpoints.Admin.Dashboard;

// ---------- DTOs ----------

public class PeriodStats
{
    public int Visitors { get; set; }
    public int NewVisitors { get; set; }
    public int Sessions { get; set; }
    public int Pageviews { get; set; }
    public double AvgSessionSeconds { get; set; }
    public double PagesPerSession { get; set; }
    public double BounceRate { get; set; }
    public int Searches { get; set; }
    public int Shares { get; set; }
    public int Likes { get; set; }
    public int Dislikes { get; set; }
    public int Comments { get; set; }
    public int PeakOnline { get; set; }
    public int DailyVisitorsSum { get; set; }
}

public class ActiveUsers
{
    public int Dau { get; set; }
    public int Wau { get; set; }
    public int Mau { get; set; }
}

public class TimePoint
{
    public string Bucket { get; set; } = string.Empty;
    public int Visitors { get; set; }
    public int NewVisitors { get; set; }
    public int Sessions { get; set; }
    public int Pageviews { get; set; }
    public int Likes { get; set; }
    public int Dislikes { get; set; }
    public int Comments { get; set; }
    public int PeakOnline { get; set; }
}

public class ActivePoint
{
    public string Bucket { get; set; } = string.Empty;
    public int Dau { get; set; }
    public int Wau { get; set; }
    public int Mau { get; set; }
}

public class BreakdownRow
{
    public string Key { get; set; } = string.Empty;
    public int Visitors { get; set; }
    public int Pageviews { get; set; }
}

public class HeatCell
{
    public int Dow { get; set; }
    public int Hour { get; set; }
    public int Visitors { get; set; }
    public int Pageviews { get; set; }
}

public class CountRow
{
    public Guid? Id { get; set; }
    public string Key { get; set; } = string.Empty;
    public string? Sub { get; set; }
    public int Count { get; set; }
    public int Count2 { get; set; }
}

// ---------- endpoints ----------

public class DashboardEndpoints : IEndpoint
{
    public void MapEndpoint(IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("admin/dashboard").RequireAuthorization("Admin");

        group.MapGet("overview", async (string? from, string? to, [FromServices] AppDbContext db,
            [FromServices] AppCalendar calendar, [FromServices] IPresenceTrackerService presence) =>
        {
            var range = DashboardRange.Parse(from, to, calendar);
            var previous = range.Previous(calendar);

            var current = await PeriodAsync(db, range);
            var before = await PeriodAsync(db, previous);

            // DAU/WAU/MAU as of the last day of the range.
            var active = await ActiveAsync(db, calendar, range.To);

            var firstEvent = await db.AnalyticsEvents.MinAsync(e => (DateTime?)e.OccurredAt);

            return Results.Ok(new
            {
                range = new { from = range.From.ToString("yyyy-MM-dd"), to = range.To.ToString("yyyy-MM-dd"), days = range.Days },
                previousRange = new { from = previous.From.ToString("yyyy-MM-dd"), to = previous.To.ToString("yyyy-MM-dd") },
                current,
                previous = before,
                active,
                avgDau = range.Days > 0 ? Math.Round(current.DailyVisitorsSum / (double)range.Days, 1) : 0,
                onlineNow = presence.GetNumberOfOnlineUsers(),
                totals = new
                {
                    visitors = await db.Visitors.CountAsync(),
                    teachers = await db.Workers.CountAsync(),
                    likes = await db.WorkerVotes.CountAsync(v => v.IsLike),
                    dislikes = await db.WorkerVotes.CountAsync(v => !v.IsLike),
                    comments = await db.Comments.IgnoreQueryFilters().CountAsync(),
                    hiddenComments = await db.Comments.IgnoreQueryFilters().CountAsync(c => c.IsDeleted),
                },
                firstEventDate = firstEvent is DateTime f ? calendar.ToLocalDate(f).ToString("yyyy-MM-dd") : null,
            });
        });

        group.MapGet("timeseries", async (string? from, string? to, [FromServices] AppDbContext db, [FromServices] AppCalendar calendar) =>
        {
            var range = DashboardRange.Parse(from, to, calendar);
            string step = range.Days <= 2 ? "1 hour" : range.Days <= 120 ? "1 day" : "7 days";
            string activeStep = range.Days <= 120 ? "1 day" : "7 days";

            var points = await db.Database.SqlQuery<TimePoint>($"""
                SELECT to_char(b, 'YYYY-MM-DD"T"HH24:MI') AS "Bucket",
                  (SELECT count(DISTINCT e."VisitorId") FROM "AnalyticsEvents" e
                     WHERE e."OccurredAt" >= (b AT TIME ZONE {range.TimeZone}) AND e."OccurredAt" < ((b + {step}::interval) AT TIME ZONE {range.TimeZone}))::int AS "Visitors",
                  (SELECT count(*) FROM "Visitors" v
                     WHERE v."FirstSeenAt" >= (b AT TIME ZONE {range.TimeZone}) AND v."FirstSeenAt" < ((b + {step}::interval) AT TIME ZONE {range.TimeZone}))::int AS "NewVisitors",
                  (SELECT count(DISTINCT e."SessionId") FROM "AnalyticsEvents" e
                     WHERE e."OccurredAt" >= (b AT TIME ZONE {range.TimeZone}) AND e."OccurredAt" < ((b + {step}::interval) AT TIME ZONE {range.TimeZone}))::int AS "Sessions",
                  (SELECT count(*) FROM "AnalyticsEvents" e WHERE e."Type" = 'pageview'
                     AND e."OccurredAt" >= (b AT TIME ZONE {range.TimeZone}) AND e."OccurredAt" < ((b + {step}::interval) AT TIME ZONE {range.TimeZone}))::int AS "Pageviews",
                  (SELECT count(*) FROM "WorkerVotes" w WHERE w."IsLike"
                     AND w."DateCreated" >= (b AT TIME ZONE {range.TimeZone}) AND w."DateCreated" < ((b + {step}::interval) AT TIME ZONE {range.TimeZone}))::int AS "Likes",
                  (SELECT count(*) FROM "WorkerVotes" w WHERE NOT w."IsLike"
                     AND w."DateCreated" >= (b AT TIME ZONE {range.TimeZone}) AND w."DateCreated" < ((b + {step}::interval) AT TIME ZONE {range.TimeZone}))::int AS "Dislikes",
                  (SELECT count(*) FROM "Comments" c
                     WHERE c."DateCreated" >= (b AT TIME ZONE {range.TimeZone}) AND c."DateCreated" < ((b + {step}::interval) AT TIME ZONE {range.TimeZone}))::int AS "Comments",
                  (SELECT coalesce(max(o."NumberOfOnlineUsers"), 0) FROM "UsersOnlineStats" o
                     WHERE o."DateCreated" >= (b AT TIME ZONE {range.TimeZone}) AND o."DateCreated" < ((b + {step}::interval) AT TIME ZONE {range.TimeZone}))::int AS "PeakOnline"
                FROM generate_series({range.FromLocalText}::timestamp, {range.ToLocalExclusiveText}::timestamp - {step}::interval, {step}::interval) AS b
                ORDER BY b
                """).ToListAsync();

            string lastDayLocal = range.To.ToString("yyyy-MM-dd");
            var active = await db.Database.SqlQuery<ActivePoint>($"""
                SELECT to_char(d, 'YYYY-MM-DD') AS "Bucket",
                  (SELECT count(DISTINCT e."VisitorId") FROM "AnalyticsEvents" e
                     WHERE e."OccurredAt" >= (d AT TIME ZONE {range.TimeZone}) AND e."OccurredAt" < ((d + interval '1 day') AT TIME ZONE {range.TimeZone}))::int AS "Dau",
                  (SELECT count(DISTINCT e."VisitorId") FROM "AnalyticsEvents" e
                     WHERE e."OccurredAt" >= ((d - interval '6 days') AT TIME ZONE {range.TimeZone}) AND e."OccurredAt" < ((d + interval '1 day') AT TIME ZONE {range.TimeZone}))::int AS "Wau",
                  (SELECT count(DISTINCT e."VisitorId") FROM "AnalyticsEvents" e
                     WHERE e."OccurredAt" >= ((d - interval '29 days') AT TIME ZONE {range.TimeZone}) AND e."OccurredAt" < ((d + interval '1 day') AT TIME ZONE {range.TimeZone}))::int AS "Mau"
                FROM generate_series({range.FromLocalText}::timestamp, {lastDayLocal}::timestamp, {activeStep}::interval) AS d
                ORDER BY d
                """).ToListAsync();

            return Results.Ok(new { granularity = step == "1 hour" ? "hour" : step == "1 day" ? "day" : "week", points, active });
        });

        group.MapGet("breakdowns", async (string? from, string? to, [FromServices] AppDbContext db, [FromServices] AppCalendar calendar) =>
        {
            var range = DashboardRange.Parse(from, to, calendar);

            var result = new Dictionary<string, List<BreakdownRow>>();
            foreach (var (name, expression) in Dimensions)
            {
                result[name] = await BreakdownAsync(db, range, expression);
            }

            result["entryPages"] = await db.Database.SqlQuery<BreakdownRow>($"""
                SELECT "Page" AS "Key", count(*)::int AS "Visitors", 0 AS "Pageviews"
                FROM (
                    SELECT DISTINCT ON ("SessionId") "Page"
                    FROM "AnalyticsEvents"
                    WHERE "OccurredAt" >= {range.FromUtc} AND "OccurredAt" < {range.ToUtcExclusive} AND "Type" = 'pageview'
                    ORDER BY "SessionId", "OccurredAt"
                ) s
                GROUP BY 1 ORDER BY 2 DESC
                """).ToListAsync();

            var heatmap = await db.Database.SqlQuery<HeatCell>($"""
                SELECT extract(isodow FROM ("OccurredAt" AT TIME ZONE {range.TimeZone}))::int AS "Dow",
                       extract(hour FROM ("OccurredAt" AT TIME ZONE {range.TimeZone}))::int AS "Hour",
                       count(DISTINCT "VisitorId")::int AS "Visitors",
                       count(*) FILTER (WHERE "Type" = 'pageview')::int AS "Pageviews"
                FROM "AnalyticsEvents"
                WHERE "OccurredAt" >= {range.FromUtc} AND "OccurredAt" < {range.ToUtcExclusive}
                GROUP BY 1, 2
                """).ToListAsync();

            return Results.Ok(new { breakdowns = result, heatmap });
        });

        group.MapGet("engagement", async (string? from, string? to, [FromServices] AppDbContext db, [FromServices] AppCalendar calendar) =>
        {
            var range = DashboardRange.Parse(from, to, calendar);
            var votes = db.WorkerVotes.AsNoTracking().Where(v => v.DateCreated >= range.FromUtc && v.DateCreated < range.ToUtcExclusive);
            var events = db.AnalyticsEvents.AsNoTracking().Where(e => e.OccurredAt >= range.FromUtc && e.OccurredAt < range.ToUtcExclusive);

            var voteTotals = await votes
                .GroupBy(v => v.WorkerId)
                .Select(g => new { WorkerId = g.Key, Likes = g.Count(v => v.IsLike), Dislikes = g.Count(v => !v.IsLike) })
                .ToListAsync();

            var commentTotals = await db.Comments.IgnoreQueryFilters().AsNoTracking()
                .Where(c => c.DateCreated >= range.FromUtc && c.DateCreated < range.ToUtcExclusive)
                .GroupBy(c => c.WorkerId)
                .Select(g => new { WorkerId = g.Key, Count = g.Count() })
                .OrderByDescending(x => x.Count).Take(10)
                .ToListAsync();

            var profileViews = await events
                .Where(e => e.Type == "pageview" && e.Page == "teacher" && e.EntityId != null)
                .GroupBy(e => e.EntityId)
                .Select(g => new { WorkerId = g.Key!.Value, Views = g.Count(), Visitors = g.Select(e => e.VisitorId).Distinct().Count() })
                .OrderByDescending(x => x.Views).Take(10)
                .ToListAsync();

            var workerIds = voteTotals.Select(x => x.WorkerId)
                .Concat(commentTotals.Select(x => x.WorkerId))
                .Concat(profileViews.Select(x => x.WorkerId))
                .ToHashSet();

            var workers = await db.Workers.IgnoreQueryFilters().AsNoTracking()
                .Where(w => workerIds.Contains(w.Id))
                .Select(w => new { w.Id, w.FullName, Departments = w.Departments.Select(d => d.ShortName).ToList() })
                .ToDictionaryAsync(w => w.Id);

            CountRow WorkerRow(Guid id, int count, int count2) => new()
            {
                Id = id,
                Key = workers.TryGetValue(id, out var w) ? w.FullName : "—",
                Sub = workers.TryGetValue(id, out var w2) ? string.Join(" · ", w2.Departments) : null,
                Count = count,
                Count2 = count2,
            };

            var departmentVotes = await votes
                .SelectMany(v => v.Worker!.Departments.Select(d => new { d.Id, d.ShortName, d.LongName, v.IsLike }))
                .GroupBy(x => new { x.Id, x.ShortName, x.LongName })
                .Select(g => new { g.Key.Id, g.Key.ShortName, g.Key.LongName, Likes = g.Count(x => x.IsLike), Dislikes = g.Count(x => !x.IsLike) })
                .OrderByDescending(x => x.Likes + x.Dislikes).Take(10)
                .ToListAsync();

            var swipeDepartments = await events
                .Where(e => (e.Type == "swipe_start" || (e.Type == "pageview" && e.Page == "swipe")) && e.EntityId != null)
                .GroupBy(e => e.EntityId)
                .Select(g => new { DepartmentId = g.Key!.Value, Visitors = g.Select(e => e.VisitorId).Distinct().Count() })
                .OrderByDescending(x => x.Visitors).Take(10)
                .ToListAsync();

            var departmentIds = swipeDepartments.Select(x => x.DepartmentId).ToList();
            var departmentNames = await db.Departments.IgnoreQueryFilters().AsNoTracking()
                .Where(d => departmentIds.Contains(d.Id))
                .ToDictionaryAsync(d => d.Id, d => new { d.ShortName, d.LongName });

            var searches = await events
                .Where(e => e.Type == "search" && e.Value != null)
                .GroupBy(e => e.Value!.ToLower())
                .Select(g => new CountRow { Key = g.Key, Count = g.Count(), Count2 = g.Select(e => e.VisitorId).Distinct().Count() })
                .OrderByDescending(x => x.Count).Take(20)
                .ToListAsync();

            var shares = await events
                .Where(e => e.Type == "share")
                .GroupBy(e => e.Value ?? "other")
                .Select(g => new CountRow { Key = g.Key, Count = g.Count() })
                .OrderByDescending(x => x.Count)
                .ToListAsync();

            // Funnel: unique visitors reaching each step within the range.
            async Task<int> Visitors(IQueryable<Entities.AnalyticsEvent> q) => await q.Select(e => e.VisitorId).Distinct().CountAsync();

            int total = await Visitors(events);
            int swiped = await Visitors(events.Where(e => e.Type == "swipe_start" || (e.Type == "pageview" && e.Page == "swipe")));
            int voted = await Visitors(events.Where(e => e.Type == "vote"));
            int viewedProfile = await Visitors(events.Where(e => e.Type == "pageview" && e.Page == "teacher"));
            int commented = await Visitors(events.Where(e => e.Type == "comment"));
            int shared = await Visitors(events.Where(e => e.Type == "share"));
            int voteEvents = await events.CountAsync(e => e.Type == "vote");

            return Results.Ok(new
            {
                topLiked = voteTotals.OrderByDescending(x => x.Likes).ThenBy(x => x.Dislikes).Where(x => x.Likes > 0).Take(10)
                    .Select(x => WorkerRow(x.WorkerId, x.Likes, x.Dislikes)),
                topDisliked = voteTotals.OrderByDescending(x => x.Dislikes).ThenBy(x => x.Likes).Where(x => x.Dislikes > 0).Take(10)
                    .Select(x => WorkerRow(x.WorkerId, x.Dislikes, x.Likes)),
                topCommented = commentTotals.Select(x => WorkerRow(x.WorkerId, x.Count, 0)),
                topViewed = profileViews.Select(x => WorkerRow(x.WorkerId, x.Views, x.Visitors)),
                topDepartments = departmentVotes.Select(x => new CountRow { Id = x.Id, Key = x.ShortName, Sub = x.LongName, Count = x.Likes, Count2 = x.Dislikes }),
                topSwipedDepartments = swipeDepartments.Select(x => new CountRow
                {
                    Id = x.DepartmentId,
                    Key = departmentNames.TryGetValue(x.DepartmentId, out var d) ? d.ShortName : "—",
                    Sub = departmentNames.TryGetValue(x.DepartmentId, out var d2) ? d2.LongName : null,
                    Count = x.Visitors,
                }),
                searches,
                shares,
                funnel = new[]
                {
                    new CountRow { Key = "Відвідали сайт", Count = total },
                    new CountRow { Key = "Відкрили свайп", Count = swiped },
                    new CountRow { Key = "Проголосували", Count = voted },
                    new CountRow { Key = "Дивились профіль", Count = viewedProfile },
                    new CountRow { Key = "Коментували", Count = commented },
                    new CountRow { Key = "Поділились", Count = shared },
                },
                votesPerVoter = voted > 0 ? Math.Round(voteEvents / (double)voted, 1) : 0,
            });
        });

        group.MapGet("live", ([FromServices] IPresenceTrackerService presence) => Results.Ok(LiveSnapshot.From(presence)));
    }

    // ---------- helpers ----------

    /// <summary>Whitelisted dimensions (SQL expressions are constants, never user input).</summary>
    private static readonly (string Name, string Expression)[] Dimensions =
    [
        ("countries", "\"Country\""),
        ("pages", "\"Page\""),
        ("devices", "\"Device\""),
        ("os", "\"Os\""),
        ("browsers", "\"Browser\""),
        ("themes", "coalesce(\"Theme\", 'unknown')"),
        ("languages", "coalesce(lower(split_part(\"Language\", '-', 1)), 'unknown')"),
        ("referrers", "coalesce(\"Referrer\", 'direct')"),
        ("utmSources", "coalesce(\"UtmSource\", '—')"),
        ("utmCampaigns", "coalesce(\"UtmCampaign\", '—')"),
        ("screens", """
            CASE WHEN "ScreenWidth" IS NULL THEN 'unknown'
                 WHEN "ScreenWidth" < 400 THEN '< 400'
                 WHEN "ScreenWidth" < 768 THEN '400–767'
                 WHEN "ScreenWidth" < 1024 THEN '768–1023'
                 WHEN "ScreenWidth" < 1440 THEN '1024–1439'
                 ELSE '≥ 1440' END
            """),
    ];

    private static Task<List<BreakdownRow>> BreakdownAsync(AppDbContext db, DashboardRange range, string expression) =>
        db.Database.SqlQueryRaw<BreakdownRow>(
            $$"""
            SELECT {{expression}} AS "Key",
                   count(DISTINCT "VisitorId")::int AS "Visitors",
                   count(*) FILTER (WHERE "Type" = 'pageview')::int AS "Pageviews"
            FROM "AnalyticsEvents"
            WHERE "OccurredAt" >= {0} AND "OccurredAt" < {1}
            GROUP BY 1
            ORDER BY 2 DESC, 3 DESC
            LIMIT 50
            """, range.FromUtc, range.ToUtcExclusive).ToListAsync();

    private static async Task<PeriodStats> PeriodAsync(AppDbContext db, DashboardRange r)
    {
        var rows = await db.Database.SqlQuery<PeriodStats>($"""
            WITH ev AS (
                SELECT "VisitorId", "SessionId", "Type", "OccurredAt"
                FROM "AnalyticsEvents"
                WHERE "OccurredAt" >= {r.FromUtc} AND "OccurredAt" < {r.ToUtcExclusive}
            ),
            sess AS (
                SELECT "SessionId",
                       extract(epoch FROM max("OccurredAt") - min("OccurredAt")) AS seconds,
                       count(*) FILTER (WHERE "Type" = 'pageview') AS pv
                FROM ev GROUP BY 1
            )
            SELECT
              (SELECT count(DISTINCT "VisitorId") FROM ev)::int AS "Visitors",
              (SELECT count(*) FROM "Visitors" WHERE "FirstSeenAt" >= {r.FromUtc} AND "FirstSeenAt" < {r.ToUtcExclusive})::int AS "NewVisitors",
              (SELECT count(*) FROM sess)::int AS "Sessions",
              (SELECT count(*) FROM ev WHERE "Type" = 'pageview')::int AS "Pageviews",
              (SELECT coalesce(avg(seconds), 0) FROM sess)::float8 AS "AvgSessionSeconds",
              (SELECT coalesce(avg(pv), 0) FROM sess)::float8 AS "PagesPerSession",
              (SELECT coalesce(avg(CASE WHEN pv <= 1 THEN 1.0 ELSE 0.0 END), 0) FROM sess)::float8 AS "BounceRate",
              (SELECT count(*) FROM ev WHERE "Type" = 'search')::int AS "Searches",
              (SELECT count(*) FROM ev WHERE "Type" = 'share')::int AS "Shares",
              (SELECT count(*) FROM "WorkerVotes" WHERE "IsLike" AND "DateCreated" >= {r.FromUtc} AND "DateCreated" < {r.ToUtcExclusive})::int AS "Likes",
              (SELECT count(*) FROM "WorkerVotes" WHERE NOT "IsLike" AND "DateCreated" >= {r.FromUtc} AND "DateCreated" < {r.ToUtcExclusive})::int AS "Dislikes",
              (SELECT count(*) FROM "Comments" WHERE "DateCreated" >= {r.FromUtc} AND "DateCreated" < {r.ToUtcExclusive})::int AS "Comments",
              (SELECT coalesce(max("NumberOfOnlineUsers"), 0) FROM "UsersOnlineStats" WHERE "DateCreated" >= {r.FromUtc} AND "DateCreated" < {r.ToUtcExclusive})::int AS "PeakOnline",
              (SELECT coalesce(sum(c), 0) FROM (
                  SELECT count(DISTINCT "VisitorId") AS c FROM ev
                  GROUP BY ("OccurredAt" AT TIME ZONE {r.TimeZone})::date
              ) daily)::int AS "DailyVisitorsSum"
            """).ToListAsync();

        return rows[0];
    }

    private static async Task<ActiveUsers> ActiveAsync(AppDbContext db, AppCalendar calendar, DateOnly day)
    {
        var end = calendar.LocalDateToUtc(day.AddDays(1));
        var d1 = calendar.LocalDateToUtc(day);
        var d7 = calendar.LocalDateToUtc(day.AddDays(-6));
        var d30 = calendar.LocalDateToUtc(day.AddDays(-29));

        var rows = await db.Database.SqlQuery<ActiveUsers>($"""
            SELECT
              (SELECT count(DISTINCT "VisitorId") FROM "AnalyticsEvents" WHERE "OccurredAt" >= {d1} AND "OccurredAt" < {end})::int AS "Dau",
              (SELECT count(DISTINCT "VisitorId") FROM "AnalyticsEvents" WHERE "OccurredAt" >= {d7} AND "OccurredAt" < {end})::int AS "Wau",
              (SELECT count(DISTINCT "VisitorId") FROM "AnalyticsEvents" WHERE "OccurredAt" >= {d30} AND "OccurredAt" < {end})::int AS "Mau"
            """).ToListAsync();

        return rows[0];
    }
}

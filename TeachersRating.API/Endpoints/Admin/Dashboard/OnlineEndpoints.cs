using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TeachersRating.API.Data;
using TeachersRating.API.Interfaces;
using TeachersRating.API.Services;

namespace TeachersRating.API.Endpoints.Admin.Dashboard;

public class OnlineBucketRow
{
    public DateTime Bucket { get; set; }
    public double Avg { get; set; }
    public int Peak { get; set; }
    public int Samples { get; set; }
}

public class OnlineProfileRow
{
    public int Key { get; set; }
    public double Avg { get; set; }
    public int Peak { get; set; }
}

public class OnlinePeakRow
{
    public DateTime DateCreated { get; set; }
    public int NumberOfOnlineUsers { get; set; }
}

/// <summary>
/// Concurrent online users from the per-minute snapshots (UsersOnlineStats):
/// a series at minute / hour / day / week / month granularity (avg + peak per bucket),
/// plus "by hour of day" and "by weekday" profiles and the all-time-in-range peak.
/// </summary>
public class OnlineEndpoints : IEndpoint
{
    private static readonly Dictionary<string, int> MaxDaysPerGranularity = new()
    {
        ["minute"] = 3,
        ["hour"] = 93,
        ["day"] = 3 * 366,
        ["week"] = 3 * 366,
        ["month"] = 3 * 366,
    };

    public void MapEndpoint(IEndpointRouteBuilder app)
    {
        app.MapGet("admin/dashboard/online", async (
            string? from, string? to, string? granularity,
            [FromServices] AppDbContext db,
            [FromServices] AppCalendar calendar,
            [FromServices] IPresenceTrackerService presence) =>
        {
            var range = DashboardRange.Parse(from, to, calendar);

            string unit = granularity is "minute" or "hour" or "day" or "week" or "month"
                ? granularity
                : range.Days <= 2 ? "hour" : range.Days <= 92 ? "day" : "week";

            // Too many points for the range -> fall back to the next coarser unit.
            while (range.Days > MaxDaysPerGranularity[unit])
            {
                unit = unit switch { "minute" => "hour", "hour" => "day", _ => "week" };
            }

            var rows = await db.Database.SqlQuery<OnlineBucketRow>($"""
                SELECT date_trunc({unit}, "DateCreated" AT TIME ZONE {range.TimeZone}) AS "Bucket",
                       avg("NumberOfOnlineUsers")::float8 AS "Avg",
                       max("NumberOfOnlineUsers")::int AS "Peak",
                       count(*)::int AS "Samples"
                FROM "UsersOnlineStats"
                WHERE "DateCreated" >= {range.FromUtc} AND "DateCreated" < {range.ToUtcExclusive}
                GROUP BY 1
                ORDER BY 1
                """).ToListAsync();

            // Fill missing buckets (server was down / no samples) so the chart has a continuous x-axis.
            var byBucket = rows.ToDictionary(r => DateTime.SpecifyKind(r.Bucket, DateTimeKind.Unspecified));
            var points = new List<object>();
            var cursor = Truncate(range.FromLocal, unit);
            var end = range.ToLocalExclusive;

            while (cursor < end)
            {
                byBucket.TryGetValue(cursor, out var row);
                points.Add(new
                {
                    bucket = cursor.ToString("yyyy-MM-dd'T'HH:mm"),
                    avg = row is null ? (double?)null : Math.Round(row.Avg, 2),
                    peak = row?.Peak,
                    samples = row?.Samples ?? 0,
                });
                cursor = Next(cursor, unit);
            }

            var byHour = await db.Database.SqlQuery<OnlineProfileRow>($"""
                SELECT extract(hour FROM "DateCreated" AT TIME ZONE {range.TimeZone})::int AS "Key",
                       avg("NumberOfOnlineUsers")::float8 AS "Avg",
                       max("NumberOfOnlineUsers")::int AS "Peak"
                FROM "UsersOnlineStats"
                WHERE "DateCreated" >= {range.FromUtc} AND "DateCreated" < {range.ToUtcExclusive}
                GROUP BY 1 ORDER BY 1
                """).ToListAsync();

            var byWeekday = await db.Database.SqlQuery<OnlineProfileRow>($"""
                SELECT extract(isodow FROM "DateCreated" AT TIME ZONE {range.TimeZone})::int AS "Key",
                       avg("NumberOfOnlineUsers")::float8 AS "Avg",
                       max("NumberOfOnlineUsers")::int AS "Peak"
                FROM "UsersOnlineStats"
                WHERE "DateCreated" >= {range.FromUtc} AND "DateCreated" < {range.ToUtcExclusive}
                GROUP BY 1 ORDER BY 1
                """).ToListAsync();

            var peak = await db.UsersOnlineStats.AsNoTracking()
                .Where(o => o.DateCreated >= range.FromUtc && o.DateCreated < range.ToUtcExclusive)
                .OrderByDescending(o => o.NumberOfOnlineUsers).ThenByDescending(o => o.DateCreated)
                .Select(o => new OnlinePeakRow { DateCreated = o.DateCreated, NumberOfOnlineUsers = o.NumberOfOnlineUsers })
                .FirstOrDefaultAsync();

            double? average = rows.Count == 0 ? null : Math.Round(rows.Sum(r => r.Avg * r.Samples) / rows.Sum(r => r.Samples), 2);

            return Results.Ok(new
            {
                granularity = unit,
                now = presence.GetNumberOfOnlineUsers(),
                average,
                peak = peak is null ? null : new { value = peak.NumberOfOnlineUsers, at = DateTime.SpecifyKind(peak.DateCreated, DateTimeKind.Utc) },
                samples = rows.Sum(r => r.Samples),
                points,
                byHour = Enumerable.Range(0, 24).Select(h =>
                {
                    var r = byHour.FirstOrDefault(x => x.Key == h);
                    return new { hour = h, avg = r is null ? (double?)null : Math.Round(r.Avg, 2), peak = r?.Peak };
                }),
                byWeekday = Enumerable.Range(1, 7).Select(d =>
                {
                    var r = byWeekday.FirstOrDefault(x => x.Key == d);
                    return new { dow = d, avg = r is null ? (double?)null : Math.Round(r.Avg, 2), peak = r?.Peak };
                }),
            });
        }).RequireAuthorization("Admin");
    }

    private static DateTime Truncate(DateTime local, string unit) => unit switch
    {
        "minute" => new DateTime(local.Year, local.Month, local.Day, local.Hour, local.Minute, 0),
        "hour" => new DateTime(local.Year, local.Month, local.Day, local.Hour, 0, 0),
        "day" => local.Date,
        // Postgres date_trunc('week') starts on Monday.
        "week" => local.Date.AddDays(-(((int)local.DayOfWeek + 6) % 7)),
        "month" => new DateTime(local.Year, local.Month, 1),
        _ => local.Date,
    };

    private static DateTime Next(DateTime bucket, string unit) => unit switch
    {
        "minute" => bucket.AddMinutes(1),
        "hour" => bucket.AddHours(1),
        "day" => bucket.AddDays(1),
        "week" => bucket.AddDays(7),
        "month" => bucket.AddMonths(1),
        _ => bucket.AddDays(1),
    };
}

namespace TeachersRating.API.Services;

/// <summary>
/// "Today" for the app is a calendar day in the configured time zone (Kyiv by default),
/// not a UTC day. All DB timestamps stay UTC.
/// </summary>
public class AppCalendar
{
    private readonly TimeZoneInfo _timeZone;

    public AppCalendar(IConfiguration configuration, ILogger<AppCalendar> logger)
    {
        string id = configuration["TimeZone"] ?? "Europe/Kyiv";
        _timeZone = Resolve(id, logger);
    }

    public DateTime NowLocal => TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, _timeZone);

    public DateOnly Today => DateOnly.FromDateTime(NowLocal);

    /// <summary>Local calendar date of a UTC instant.</summary>
    public DateOnly ToLocalDate(DateTime utc) =>
        DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(utc, DateTimeKind.Utc), _timeZone));

    /// <summary>UTC instant when the local day <paramref name="daysAgo"/> days back started.</summary>
    public DateTime StartOfDayUtc(int daysAgo = 0)
    {
        var localMidnight = DateTime.SpecifyKind(NowLocal.Date.AddDays(-daysAgo), DateTimeKind.Unspecified);
        return TimeZoneInfo.ConvertTimeToUtc(localMidnight, _timeZone);
    }

    private static TimeZoneInfo Resolve(string id, ILogger logger)
    {
        foreach (var candidate in new[] { id, "Europe/Kiev", "FLE Standard Time" })
        {
            try
            {
                return TimeZoneInfo.FindSystemTimeZoneById(candidate);
            }
            catch (Exception ex) when (ex is TimeZoneNotFoundException or InvalidTimeZoneException)
            {
            }
        }

        logger.LogWarning("Time zone {TimeZone} not found, falling back to fixed UTC+2", id);
        return TimeZoneInfo.CreateCustomTimeZone("UTC+2", TimeSpan.FromHours(2), "UTC+2", "UTC+2");
    }
}

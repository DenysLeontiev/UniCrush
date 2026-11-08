using TeachersRating.API.Services;

namespace TeachersRating.API.Endpoints.Admin.Dashboard;

/// <summary>
/// Inclusive local (Kyiv) date range from the dashboard date picker, plus the UTC instants
/// and local timestamps the SQL needs.
/// </summary>
public record DashboardRange(DateOnly From, DateOnly To, DateTime FromUtc, DateTime ToUtcExclusive, string TimeZone)
{
    public int Days => To.DayNumber - From.DayNumber + 1;

    /// <summary>Local midnight of the first day (timestamp without time zone for generate_series).</summary>
    public DateTime FromLocal => DateTime.SpecifyKind(From.ToDateTime(TimeOnly.MinValue), DateTimeKind.Unspecified);

    // Text forms for SQL (cast with ::timestamp). EF would send DateTime as timestamptz, which must be UTC.
    public string FromLocalText => From.ToString("yyyy-MM-dd");
    public string ToLocalExclusiveText => To.AddDays(1).ToString("yyyy-MM-dd");

    /// <summary>Local midnight after the last day.</summary>
    public DateTime ToLocalExclusive => DateTime.SpecifyKind(To.AddDays(1).ToDateTime(TimeOnly.MinValue), DateTimeKind.Unspecified);

    public static DashboardRange Parse(string? from, string? to, AppCalendar calendar)
    {
        var today = calendar.Today;
        var toDate = DateOnly.TryParse(to, out var t) ? t : today;
        var fromDate = DateOnly.TryParse(from, out var f) ? f : toDate.AddDays(-6);

        if (toDate > today) toDate = today;
        if (fromDate > toDate) fromDate = toDate;
        if (toDate.DayNumber - fromDate.DayNumber > 3 * 366) fromDate = toDate.AddDays(-3 * 366);

        return Create(fromDate, toDate, calendar);
    }

    public static DashboardRange Create(DateOnly from, DateOnly to, AppCalendar calendar) =>
        new(from, to, calendar.LocalDateToUtc(from), calendar.LocalDateToUtc(to.AddDays(1)), calendar.TimeZoneId);

    /// <summary>The same number of days right before this range (for "vs previous period").</summary>
    public DashboardRange Previous(AppCalendar calendar) =>
        Create(From.AddDays(-Days), From.AddDays(-1), calendar);
}

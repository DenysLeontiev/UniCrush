namespace TeachersRating.API.Entities;

/// <summary>
/// An anonymous browser (random id kept in the visitor's localStorage). No IPs are stored.
/// FirstSeenAt drives "new vs returning".
/// </summary>
public class Visitor
{
    public string Id { get; set; } = string.Empty;
    public DateTime FirstSeenAt { get; set; }
    public DateTime LastSeenAt { get; set; }
    public string Country { get; set; } = "XX";
    public string Device { get; set; } = "unknown";
    public string Os { get; set; } = "unknown";
    public string Browser { get; set; } = "unknown";
}

/// <summary>One tracked event (page view, vote, search, …). Kept forever.</summary>
public class AnalyticsEvent
{
    public long Id { get; set; }
    public DateTime OccurredAt { get; set; }

    public string VisitorId { get; set; } = string.Empty;
    public string SessionId { get; set; } = string.Empty;

    /// <summary>pageview | vote | comment | search | swipe_start | share</summary>
    public string Type { get; set; } = string.Empty;

    /// <summary>Normalized page: home | swipe | leaderboard | teacher | other.</summary>
    public string Page { get; set; } = "other";
    public string Path { get; set; } = string.Empty;

    /// <summary>Teacher / department id the event is about (if any).</summary>
    public Guid? EntityId { get; set; }

    /// <summary>Free value: search text, share channel, …</summary>
    public string? Value { get; set; }

    // context (copied per event so breakdowns for any period are exact)
    public string Country { get; set; } = "XX";
    public string Device { get; set; } = "unknown";
    public string Os { get; set; } = "unknown";
    public string Browser { get; set; } = "unknown";
    public int? ScreenWidth { get; set; }
    public int? ScreenHeight { get; set; }
    public string? Theme { get; set; }
    public string? Language { get; set; }
    public string? Referrer { get; set; }
    public string? UtmSource { get; set; }
    public string? UtmMedium { get; set; }
    public string? UtmCampaign { get; set; }
}

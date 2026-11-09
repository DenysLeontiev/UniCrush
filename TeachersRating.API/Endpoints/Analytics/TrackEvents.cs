using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Mvc;
using TeachersRating.API.Entities;
using TeachersRating.API.Interfaces;
using TeachersRating.API.Services.Analytics;

namespace TeachersRating.API.Endpoints.Analytics;

public class TrackContextDto
{
    public int? ScreenWidth { get; set; }
    public int? ScreenHeight { get; set; }
    public string? Theme { get; set; }
    public string? Language { get; set; }
    public string? Referrer { get; set; }
    public string? UtmSource { get; set; }
    public string? UtmMedium { get; set; }
    public string? UtmCampaign { get; set; }
}

public class TrackEventDto
{
    public string Type { get; set; } = string.Empty;
    public string? Path { get; set; }
    public Guid? EntityId { get; set; }
    public string? Value { get; set; }
    public DateTime? At { get; set; }
}

public class TrackRequestDto
{
    public string VisitorId { get; set; } = string.Empty;
    public string SessionId { get; set; } = string.Empty;
    public TrackContextDto? Context { get; set; }
    public List<TrackEventDto> Events { get; set; } = new();
}

/// <summary>
/// Batched analytics events from the browser (also accepts navigator.sendBeacon).
/// Validates and enriches them, then hands them to the background writer — no DB work in the request.
/// </summary>
public partial class TrackEvents : IEndpoint
{
    private static readonly HashSet<string> AllowedTypes =
    [
        "pageview", "vote", "comment", "search", "swipe_start", "share",
        // behaviour
        "engage", "skip", "filter", "load_more", "open_comments", "outbound", "theme", "error", "perf",
    ];

    public void MapEndpoint(IEndpointRouteBuilder app)
    {
        app.MapPost("track", ([FromBody] TrackRequestDto request, [FromServices] AnalyticsQueue queue, HttpContext http) =>
        {
            string visitorId = request.VisitorId ?? string.Empty;
            string sessionId = request.SessionId ?? string.Empty;

            if (!IdRegex().IsMatch(visitorId) || !IdRegex().IsMatch(sessionId))
            {
                return Results.BadRequest();
            }

            var client = ClientInfoReader.Read(http.Request);
            if (client.IsBot)
            {
                return Results.NoContent();
            }

            var now = DateTime.UtcNow;
            var ctx = request.Context ?? new TrackContextDto();
            string? ownHost = http.Request.Host.Host;

            var events = (request.Events ?? [])
                .Where(e => AllowedTypes.Contains(e.Type))
                .Take(50)
                .Select(e =>
                {
                    var (page, pathEntity, path) = PageClassifier.Classify(e.Path);
                    // Accept client timestamps only within the last hour (queued events), never in the future.
                    var at = e.At?.ToUniversalTime() is DateTime t && t <= now && t >= now.AddHours(-1) ? t : now;

                    return new AnalyticsEvent
                    {
                        OccurredAt = at,
                        VisitorId = visitorId,
                        SessionId = sessionId,
                        Type = e.Type,
                        Page = page,
                        Path = path,
                        EntityId = e.EntityId ?? pathEntity,
                        Value = Trim(e.Value, 200),
                        Country = client.Country,
                        Device = client.Device,
                        Os = client.Os,
                        Browser = client.Browser,
                        ScreenWidth = Clamp(ctx.ScreenWidth),
                        ScreenHeight = Clamp(ctx.ScreenHeight),
                        Theme = ctx.Theme is "light" or "dark" ? ctx.Theme : null,
                        Language = Trim(ctx.Language, 16),
                        Referrer = ReferrerHost(ctx.Referrer, ownHost),
                        UtmSource = Trim(ctx.UtmSource, 64),
                        UtmMedium = Trim(ctx.UtmMedium, 64),
                        UtmCampaign = Trim(ctx.UtmCampaign, 64),
                    };
                })
                .ToList();

            if (events.Count == 0)
            {
                return Results.NoContent();
            }

            // Queue only: the background AnalyticsWriter writes to the database in batches.
            queue.TryEnqueue(new TrackBatch(visitorId, client, events));
            return Results.NoContent();
        }).RequireRateLimiting("track");
    }

    private static string? Trim(string? value, int max)
    {
        value = value?.Trim();
        return string.IsNullOrEmpty(value) ? null : value.Length > max ? value[..max] : value;
    }

    private static int? Clamp(int? value) => value is > 0 and < 10000 ? value : null;

    private static string? ReferrerHost(string? referrer, string? ownHost)
    {
        if (!Uri.TryCreate(referrer, UriKind.Absolute, out var uri) || uri.Scheme is not ("http" or "https"))
        {
            return null;
        }

        string host = uri.Host.ToLowerInvariant();
        if (host.StartsWith("www.")) host = host[4..];
        if (ownHost is not null && host == ownHost.ToLowerInvariant()) return null;

        // Group known apps / sites under a readable name.
        return host switch
        {
            "t.me" or "web.telegram.org" or "telegram.org" => "telegram",
            "l.instagram.com" or "instagram.com" => "instagram",
            "lm.facebook.com" or "l.facebook.com" or "m.facebook.com" or "facebook.com" => "facebook",
            "t.co" or "x.com" or "twitter.com" => "x.com",
            _ when host.StartsWith("google.") => "google",
            _ => host.Length > 100 ? host[..100] : host,
        };
    }

    [GeneratedRegex("^[A-Za-z0-9-]{8,64}$")]
    private static partial Regex IdRegex();
}

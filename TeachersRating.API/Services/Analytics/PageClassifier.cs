namespace TeachersRating.API.Services.Analytics;

/// <summary>Maps a client route to a page name (+ the teacher/department id it shows).</summary>
public static class PageClassifier
{
    public static (string Page, Guid? EntityId, string Path) Classify(string? rawPath)
    {
        string path = (rawPath ?? string.Empty).Split('?', '#')[0].Trim();
        if (path.Length > 200) path = path[..200];
        if (!path.StartsWith('/')) path = "/" + path;

        var segments = path.Split('/', StringSplitOptions.RemoveEmptyEntries);
        string first = segments.Length > 0 ? segments[0].ToLowerInvariant() : string.Empty;
        Guid? id = segments.Length > 1 && Guid.TryParse(segments[1], out var g) ? g : null;

        string page = first switch
        {
            "" or "home" => "home",
            "comparison" => "swipe",
            "leaderboard" or "top-workers" => "leaderboard",
            "teacher" => "teacher",
            "admin" or "users-stats-secret" => "admin",
            _ => "other",
        };

        return (page, id, path);
    }
}

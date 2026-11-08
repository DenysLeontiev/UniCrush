using System.Text.RegularExpressions;

namespace TeachersRating.API.Services.Analytics;

public record ClientInfo(string Country, string Device, string Os, string Browser, bool IsBot);

/// <summary>Country from Cloudflare + a small User-Agent parser (no IPs, no external packages).</summary>
public static partial class ClientInfoReader
{
    public static ClientInfo Read(HttpRequest request)
    {
        string ua = request.Headers.UserAgent.ToString();
        return new ClientInfo(Country(request), Device(ua), Os(ua), Browser(ua), IsBot(ua));
    }

    /// <summary>ISO country code from Cloudflare's CF-IPCountry header ("XX" = unknown / LAN).</summary>
    public static string Country(HttpRequest request)
    {
        string value = request.Headers["CF-IPCountry"].ToString().Trim().ToUpperInvariant();
        return value.Length == 2 && char.IsLetter(value[0]) && char.IsLetter(value[1]) && value != "T1" ? value : "XX";
    }

    public static bool IsBot(string ua) =>
        string.IsNullOrWhiteSpace(ua) || BotRegex().IsMatch(ua);

    public static string Device(string ua)
    {
        if (TabletRegex().IsMatch(ua)) return "tablet";
        if (MobileRegex().IsMatch(ua)) return "mobile";
        return "desktop";
    }

    public static string Os(string ua)
    {
        if (ua.Contains("iPhone") || ua.Contains("iPad") || ua.Contains("iPod")) return "iOS";
        if (ua.Contains("Android")) return "Android";
        if (ua.Contains("Windows")) return "Windows";
        if (ua.Contains("Mac OS X") || ua.Contains("Macintosh")) return "macOS";
        if (ua.Contains("CrOS")) return "ChromeOS";
        if (ua.Contains("Linux")) return "Linux";
        return "other";
    }

    public static string Browser(string ua)
    {
        if (ua.Contains("Telegram")) return "Telegram";
        if (ua.Contains("Instagram")) return "Instagram";
        if (ua.Contains("FBAN") || ua.Contains("FBAV")) return "Facebook";
        if (ua.Contains("TikTok") || ua.Contains("musical_ly")) return "TikTok";
        if (ua.Contains("Edg/") || ua.Contains("EdgA/") || ua.Contains("EdgiOS/")) return "Edge";
        if (ua.Contains("OPR/") || ua.Contains("Opera")) return "Opera";
        if (ua.Contains("SamsungBrowser")) return "Samsung Internet";
        if (ua.Contains("YaBrowser")) return "Yandex";
        if (ua.Contains("Firefox/") || ua.Contains("FxiOS/")) return "Firefox";
        if (ua.Contains("CriOS/") || ua.Contains("Chrome/")) return "Chrome";
        if (ua.Contains("Safari/")) return "Safari";
        return "other";
    }

    [GeneratedRegex(@"bot|crawl|spider|slurp|preview|facebookexternalhit|headless|lighthouse|curl|wget|python|httpclient", RegexOptions.IgnoreCase)]
    private static partial Regex BotRegex();

    [GeneratedRegex(@"iPad|Tablet|(Android(?!.*Mobile))", RegexOptions.IgnoreCase)]
    private static partial Regex TabletRegex();

    [GeneratedRegex(@"Mobi|iPhone|iPod|Android.*Mobile|Windows Phone", RegexOptions.IgnoreCase)]
    private static partial Regex MobileRegex();
}

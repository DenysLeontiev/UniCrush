using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using TeachersRating.API.Interfaces;
using TeachersRating.API.Services.Analytics;

namespace TeachersRating.API.Hubs;

/// <summary>
/// Every open tab connects here (?v=visitorId). Admins join "AdminGroup" and receive a live
/// snapshot (who is online, from where, on which page) — coalesced by LiveSnapshotBroadcaster.
/// </summary>
public partial class PresenceHub : Hub
{
    public const string AdminGroup = "AdminGroup";

    private readonly IPresenceTrackerService _presenceTracker;
    private readonly LiveSnapshotBroadcaster _broadcaster;

    public PresenceHub(IPresenceTrackerService presenceTracker, LiveSnapshotBroadcaster broadcaster)
    {
        _presenceTracker = presenceTracker;
        _broadcaster = broadcaster;
    }

    public override async Task OnConnectedAsync()
    {
        var http = Context.GetHttpContext();
        string visitorId = http?.Request.Query["v"].ToString() ?? string.Empty;
        if (!VisitorIdRegex().IsMatch(visitorId))
        {
            visitorId = Context.ConnectionId;
        }

        var client = http is not null
            ? ClientInfoReader.Read(http.Request)
            : new ClientInfo("XX", "unknown", "unknown", "unknown", false);

        _presenceTracker.UserConnected(new OnlineConnection(
            Context.ConnectionId, visitorId, client.Country, client.Device, client.Os, client.Browser, DateTime.UtcNow));

        _broadcaster.MarkDirty();
        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        _presenceTracker.UserDisconnected(Context.ConnectionId);
        _broadcaster.MarkDirty();
        await base.OnDisconnectedAsync(exception);
    }

    /// <summary>Called by the client on every route change.</summary>
    public void SetPage(string path)
    {
        _presenceTracker.SetPage(Context.ConnectionId, path);
        _broadcaster.MarkDirty();
    }

    [Authorize(Policy = "Admin")]
    public async Task JoinAdminGroup()
    {
        _presenceTracker.MarkAdmin(Context.ConnectionId);
        await Groups.AddToGroupAsync(Context.ConnectionId, AdminGroup);
        await Clients.Caller.SendAsync("PresenceSnapshot", LiveSnapshot.From(_presenceTracker));
        _broadcaster.MarkDirty(); // this admin no longer counts as a visitor
    }

    [Authorize(Policy = "Admin")]
    public async Task LeaveAdminGroup()
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, AdminGroup);
    }

    [GeneratedRegex("^[A-Za-z0-9-]{8,64}$")]
    private static partial Regex VisitorIdRegex();
}

public record KeyCount(string Key, int Count);

public record LiveSession(string Visitor, string Country, string Device, string Os, string Browser, string Page, string? Path, DateTime ConnectedAt);

public record LiveSnapshot(int OnlineVisitors, int OpenTabs, List<KeyCount> ByCountry, List<KeyCount> ByPage, List<KeyCount> ByDevice, List<LiveSession> Sessions)
{
    public static LiveSnapshot From(IPresenceTrackerService tracker)
    {
        var connections = tracker.GetConnections();

        // One row per visitor (their most recent tab).
        var visitors = connections
            .GroupBy(c => c.VisitorId)
            .Select(g => g.OrderByDescending(c => c.ConnectedAt).First())
            .ToList();

        static List<KeyCount> Count(IEnumerable<string> keys) =>
            keys.GroupBy(k => k).Select(g => new KeyCount(g.Key, g.Count())).OrderByDescending(x => x.Count).ToList();

        return new LiveSnapshot(
            visitors.Count,
            connections.Count,
            Count(visitors.Select(v => v.Country)),
            Count(visitors.Select(v => v.Page)),
            Count(visitors.Select(v => v.Device)),
            visitors
                .OrderByDescending(v => v.ConnectedAt)
                .Take(100)
                .Select(v => new LiveSession(v.VisitorId.Length > 8 ? v.VisitorId[..8] : v.VisitorId,
                    v.Country, v.Device, v.Os, v.Browser, v.Page, v.Path, v.ConnectedAt))
                .ToList());
    }
}

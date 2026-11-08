using System.Collections.Concurrent;
using TeachersRating.API.Interfaces;
using TeachersRating.API.Services.Analytics;

namespace TeachersRating.API.Services;

/// <summary>In-memory list of live SignalR connections (one per open tab).</summary>
public class PresenceTrackerService : IPresenceTrackerService
{
    private readonly ConcurrentDictionary<string, OnlineConnection> _connections = new();

    public void UserConnected(OnlineConnection connection) => _connections[connection.ConnectionId] = connection;

    public void UserDisconnected(string connectionId) => _connections.TryRemove(connectionId, out _);

    public void SetPage(string connectionId, string? path)
    {
        if (_connections.TryGetValue(connectionId, out var connection))
        {
            var (page, _, normalized) = PageClassifier.Classify(path);
            connection.Path = normalized;
            connection.Page = page;
        }
    }

    public void MarkAdmin(string connectionId)
    {
        if (_connections.TryGetValue(connectionId, out var connection))
        {
            connection.IsAdmin = true;
        }
    }

    public int GetNumberOfOnlineUsers() =>
        Visible().Select(c => c.VisitorId).Distinct().Count();

    public IReadOnlyList<OnlineConnection> GetConnections() =>
        Visible().OrderBy(c => c.ConnectedAt).ToList();

    /// <summary>Real visitors only: admins and anyone on an admin page are not counted.</summary>
    private IEnumerable<OnlineConnection> Visible() =>
        _connections.Values.Where(c => !c.IsAdmin && c.Page != "admin");
}

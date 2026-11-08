namespace TeachersRating.API.Interfaces;

public record OnlineConnection(
    string ConnectionId,
    string VisitorId,
    string Country,
    string Device,
    string Os,
    string Browser,
    DateTime ConnectedAt)
{
    public string? Path { get; set; }
    public string Page { get; set; } = "other";
    public bool IsAdmin { get; set; }
}

public interface IPresenceTrackerService
{
    void UserConnected(OnlineConnection connection);
    void UserDisconnected(string connectionId);
    void SetPage(string connectionId, string? path);
    void MarkAdmin(string connectionId);

    /// <summary>Distinct visitors online (admins excluded).</summary>
    int GetNumberOfOnlineUsers();

    IReadOnlyList<OnlineConnection> GetConnections();
}

using Microsoft.AspNetCore.SignalR;
using TeachersRating.API.Interfaces;

namespace TeachersRating.API.Hubs;

/// <summary>
/// Coalesces presence changes: connects/disconnects/page changes only mark the snapshot "dirty";
/// admins get at most one live snapshot every <see cref="Interval"/>, however busy the site is.
/// </summary>
public class LiveSnapshotBroadcaster : BackgroundService
{
    private static readonly TimeSpan Interval = TimeSpan.FromSeconds(2);

    private readonly IHubContext<PresenceHub> _hub;
    private readonly IPresenceTrackerService _tracker;
    private readonly ILogger<LiveSnapshotBroadcaster> _logger;
    private int _dirty;

    public LiveSnapshotBroadcaster(IHubContext<PresenceHub> hub, IPresenceTrackerService tracker, ILogger<LiveSnapshotBroadcaster> logger)
    {
        _hub = hub;
        _tracker = tracker;
        _logger = logger;
    }

    public void MarkDirty() => Interlocked.Exchange(ref _dirty, 1);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(Interval);

        try
        {
            while (await timer.WaitForNextTickAsync(stoppingToken))
            {
                if (Interlocked.Exchange(ref _dirty, 0) == 0) continue;

                try
                {
                    await _hub.Clients.Group(PresenceHub.AdminGroup)
                        .SendAsync("PresenceSnapshot", LiveSnapshot.From(_tracker), stoppingToken);
                }
                catch (Exception ex) when (ex is not OperationCanceledException)
                {
                    _logger.LogWarning(ex, "Failed to push live snapshot");
                }
            }
        }
        catch (OperationCanceledException)
        {
            // shutting down
        }
    }
}

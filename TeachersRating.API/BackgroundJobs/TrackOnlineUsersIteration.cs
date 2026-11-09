using Microsoft.EntityFrameworkCore;
using TeachersRating.API.Data;
using TeachersRating.API.Interfaces;

namespace TeachersRating.API.BackgroundJobs;

public class TrackOnlineUsersIteration : IContinuousWorkIteration
{
    private readonly AppDbContext _context;
    private readonly IPresenceTrackerService _presenceTracker;
    private readonly ILogger<TrackOnlineUsersIteration> _logger;

    public TrackOnlineUsersIteration(AppDbContext context,
        IPresenceTrackerService presenceTracker,
        ILogger<TrackOnlineUsersIteration> logger)
    {
        _context = context;
        _presenceTracker = presenceTracker;
        _logger = logger;
    }

    public async Task Run(CancellationToken stoppingToken)
    {
        // Sample on every whole minute (hh:mm:00) so hourly/daily buckets line up exactly.
        var now = DateTime.UtcNow;
        var nextMinute = new DateTime(now.Year, now.Month, now.Day, now.Hour, now.Minute, 0, DateTimeKind.Utc).AddMinutes(1);

        await Task.Delay(nextMinute - now, stoppingToken);

        int onlineUsers = _presenceTracker.GetNumberOfOnlineUsers();

        Entities.UsersOnlineStat usersOnlineStat = new Entities.UsersOnlineStat(onlineUsers);
        await _context.UsersOnlineStats.AddAsync(usersOnlineStat);

        await _context.SaveChangesAsync();

        _logger.LogDebug(
            "Online snapshot at {time}: {count} users online",
            DateTime.UtcNow,
            onlineUsers
        );
    }

    public static async Task OnException(Exception ex, ILogger logger)
    {
        logger.LogError(ex, "An error occurred");
        await Task.Delay(500);
    }
}
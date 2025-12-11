using Microsoft.EntityFrameworkCore;
using TeachersRating.API.Data;
using TeachersRating.API.Data.Migrations;
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
        int minutesAhead = 1;

        var now = DateTime.UtcNow;
        var nMinutesAhead = now.AddMinutes(minutesAhead);

        TimeSpan delay = nMinutesAhead - now;

        await Task.Delay(delay, stoppingToken);

        int onlineUsers = _presenceTracker.GetNumberOfOnlineUsers();

        Entities.UsersOnlineStat usersOnlineStat = new Entities.UsersOnlineStat(onlineUsers);
        await _context.UsersOnlineStats.AddAsync(usersOnlineStat);

        await _context.SaveChangesAsync();

        _logger.LogInformation(
            "Hourly run at {time}: {count} users online",
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
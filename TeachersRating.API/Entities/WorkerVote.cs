namespace TeachersRating.API.Entities;

/// <summary>
/// One like/dislike event. Worker.NumberOfLikes/NumberOfDislikes stay as all-time counters;
/// this log is what makes "Краш дня" and period-based leaderboards possible.
/// </summary>
public class WorkerVote : BaseEntity
{
    public Guid WorkerId { get; set; }
    public Worker? Worker { get; set; }

    public bool IsLike { get; set; }
}

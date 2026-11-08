namespace TeachersRating.API.DTOs;

public class LeaderboardEntryDto
{
    public int Rank { get; set; }
    public Guid Id { get; set; }
    public string FullName { get; set; } = string.Empty;
    public string Position { get; set; } = string.Empty;
    public string PersonalPageUrl { get; set; } = string.Empty;
    public string PhotoUrl { get; set; } = string.Empty;

    /// <summary>Likes/dislikes within the requested period (all-time for "all").</summary>
    public long Likes { get; set; }
    public long Dislikes { get; set; }
    public int NumberOfComments { get; set; }

    public List<LeaderboardDepartmentDto> Departments { get; set; } = new();
}

public class LeaderboardDepartmentDto
{
    public Guid Id { get; set; }
    public string ShortName { get; set; } = string.Empty;
    public string LongName { get; set; } = string.Empty;
    public Guid InstituteId { get; set; }
    public string InstituteName { get; set; } = string.Empty;
}

public class TodaysCrushDto
{
    /// <summary>Local (Kyiv) date the crush is for, yyyy-MM-dd.</summary>
    public string Date { get; set; } = string.Empty;

    /// <summary>Null when nobody got a like today yet (within the filter).</summary>
    public LeaderboardEntryDto? Worker { get; set; }

    /// <summary>Total likes given today (within the filter).</summary>
    public long TotalLikesToday { get; set; }
}

using System.Runtime.ConstrainedExecution;

namespace TeachersRating.API.DTOs;

public class WorkerDto
{
    public Guid Id { get; set; }
    public string FullName { get; set; } = string.Empty;
    public string Position { get; set; } = string.Empty;
    public string PersonalPageUrl { get; set; } = string.Empty;
    public uint NumberOfLikes { get; set; }
    public uint NumberOfDislikes { get; set; }
    public uint NumberOfComments { get; set; }
    public PhotoDto Photo { get; set; } = new();
    public List<DepartmentSimpleDto> Departments { get; set; } = new();
}

public class WorkerSimpleDto
{
    public Guid Id { get; set; }
    public string FullName { get; set; } = string.Empty;
    public string Position { get; set; } = string.Empty;
    public uint NumberOfLikes { get; set; }
    public uint NumberOfDislikes { get; set; }
}
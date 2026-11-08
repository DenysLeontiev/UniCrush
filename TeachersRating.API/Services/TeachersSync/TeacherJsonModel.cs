namespace TeachersRating.API.Services.TeachersSync;

// Shape of NulpScrapper/output.json (one row per teacher per department).

public class TeacherJsonModel
{
    public string? imageUrl { get; set; }
    public string? fullName { get; set; }
    public string? position { get; set; }
    public string? personalPageHref { get; set; }
    public DepartmentJsonModel? department { get; set; }
}

public class DepartmentJsonModel
{
    public InstituteJsonModel? institute { get; set; }
    public string? href { get; set; }
    public string? longName { get; set; }
    public string? shortName { get; set; }
    public string? workersPageHref { get; set; }
}

public class InstituteJsonModel
{
    public string? name { get; set; }
    public string? href { get; set; }
}

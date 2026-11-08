using Microsoft.EntityFrameworkCore;
using TeachersRating.API.Data;
using TeachersRating.API.DTOs;

namespace TeachersRating.API.Endpoints.Leaderboard;

public static class LeaderboardQueries
{
    /// <summary>Teachers belonging to the department (if given) or the institute (if given).</summary>
    public static IQueryable<Entities.Worker> FilterByPlace(IQueryable<Entities.Worker> workers, Guid? instituteId, Guid? departmentId)
    {
        if (departmentId is Guid departmentGuid)
        {
            return workers.Where(w => w.Departments.Any(d => d.Id == departmentGuid));
        }

        if (instituteId is Guid instituteGuid)
        {
            return workers.Where(w => w.Departments.Any(d => d.InstituteId == instituteGuid));
        }

        return workers;
    }

    /// <summary>Loads photo/position/departments for the given teachers, keyed by id.</summary>
    public static async Task<Dictionary<Guid, LeaderboardEntryDto>> LoadDetailsAsync(AppDbContext context, IReadOnlyCollection<Guid> ids)
    {
        if (ids.Count == 0)
        {
            return new();
        }

        var details = await context.Workers
            .AsNoTracking()
            .Where(w => ids.Contains(w.Id))
            .Select(w => new LeaderboardEntryDto
            {
                Id = w.Id,
                FullName = w.FullName,
                Position = w.Position,
                PersonalPageUrl = w.PersonalPageUrl,
                PhotoUrl = w.Photo != null ? w.Photo.Url : string.Empty,
                NumberOfComments = w.Comments.Count(c => !c.IsDeleted),
                Departments = w.Departments
                    .OrderBy(d => d.ShortName)
                    .Select(d => new LeaderboardDepartmentDto
                    {
                        Id = d.Id,
                        ShortName = d.ShortName,
                        LongName = d.LongName,
                        InstituteId = d.InstituteId,
                        InstituteName = d.Institute != null ? d.Institute.Name : string.Empty,
                    })
                    .ToList(),
            })
            .AsSplitQuery()
            .ToListAsync();

        return details.ToDictionary(x => x.Id);
    }
}

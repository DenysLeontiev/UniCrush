using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TeachersRating.API.Data;
using TeachersRating.API.Extensions;
using TeachersRating.API.Interfaces;

namespace TeachersRating.API.Endpoints.Worker.Query.GetTopWorkersForDepartmentById;

public class GetTopWorkersForDepartmentById : IEndpoint
{
    public void MapEndpoint(IEndpointRouteBuilder app)
    {
        app.MapGet("{departmentId:guid}/top-workers", async (Guid departmentId, [FromServices] AppDbContext context) =>
        {
            var topWorkers = await context.Workers
                                          .Where(x => x.Departments.Any(d => d.Id == departmentId))
                                          .Include(p => p.Photo)
                                          .Include(x => x.Comments)
                                          .OrderByDescending(x => x.NumberOfLikes)
                                          .AsNoTracking()
                                          .ToListAsync();

            var mappedTopWorkers = topWorkers.Select(x => x.ToDto());

            return Results.Ok(mappedTopWorkers);
        }).WithName("TopWorkersForDepartment");
    }
}
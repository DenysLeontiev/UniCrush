using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TeachersRating.API.Data;
using TeachersRating.API.Extensions;
using TeachersRating.API.Interfaces;

namespace TeachersRating.API.Endpoints.Worker.Query.GetWorkersForDepartmentById;

public class GetWorkersForDepartmentById : IEndpoint
{
    public void MapEndpoint(IEndpointRouteBuilder app)
    {
        app.MapGet("/workers/{departmentId:guid}", async (Guid departmentId, [FromServices] AppDbContext context) =>
        {
            var workers = await context.Workers.Where(w => w.Departments.Any(d => d.Id == departmentId))
                .Include(x => x.Photo)
                .AsNoTracking()
                .ToListAsync();

            var mappedWorkers = workers.Select(w => w.ToDto()).ToList();

            return Results.Ok(mappedWorkers);
        }).WithName("GetWorkersForDepartment");
    }
}
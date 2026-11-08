using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TeachersRating.API.Data;
using TeachersRating.API.Extensions;
using TeachersRating.API.Interfaces;

namespace TeachersRating.API.Endpoints.Worker.Query.GetTwoRandomWorkersForDepartment;

public class GetTwoRandomWorkersForDepartmentById : IEndpoint
{
    public void MapEndpoint(IEndpointRouteBuilder app)
    {
        app.MapGet("/two-random-workers/{departmentId:guid}", async (Guid departmentId, [FromServices] AppDbContext context) =>
        {
            var departmentWorkers = context.Workers
                .Where(x => x.Departments.Any(d => d.Id == departmentId))
                .OrderBy(x => x.Id);

            int workersRecordsCount = await departmentWorkers.CountAsync();

            if (workersRecordsCount < 2)
            {
                return Results.BadRequest("Department has fewer than two teachers.");
            }

            int firstOffset = Random.Shared.Next(0, workersRecordsCount);
            int secondOffset = Random.Shared.Next(0, workersRecordsCount - 1);

            if (secondOffset >= firstOffset)
            {
                secondOffset++;
            }

            var firstWorker = await departmentWorkers.Include(p => p.Photo)
                                                     .Include(d => d.Departments)
                                                     .Skip(firstOffset)
                                                     .FirstAsync();

            var secondWorker = await departmentWorkers.Include(p => p.Photo)
                                                      .Include(d => d.Departments)
                                                      .Skip(secondOffset)
                                                      .FirstAsync();

            var mappedWorkersArray = new[] { firstWorker, secondWorker }.Select(w => w.ToDto());

            return Results.Ok(mappedWorkersArray);
        });
    }
}

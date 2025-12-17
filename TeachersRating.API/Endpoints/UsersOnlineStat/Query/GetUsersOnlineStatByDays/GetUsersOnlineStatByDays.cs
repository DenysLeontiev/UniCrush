
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TeachersRating.API.Data;
using TeachersRating.API.Extensions;
using TeachersRating.API.Interfaces;

namespace TeachersRating.API.Endpoints.UsersOnlineStat.Query.GetUsersOnlineStatByDays;

public class GetUsersOnlineStatByDays : IEndpoint
{
    public void MapEndpoint(IEndpointRouteBuilder app)
    {
        app.Map("stats/days", async ([FromServices] AppDbContext context, [FromQuery] DateTime dateStart, [FromQuery] DateTime dateEnd) =>
        {
            var stats = await context.UsersOnlineStats.Where(x => x.DateCreated >= dateStart && x.DateCreated <= dateEnd)
                                                      .OrderByDescending(x => x.DateCreated)
                                                      .AsNoTracking()
                                                      .ToListAsync();

            var statsDto = stats.Select(x => x.ToDto()).ToList();

            return Results.Ok(statsDto);
        });
    }
}
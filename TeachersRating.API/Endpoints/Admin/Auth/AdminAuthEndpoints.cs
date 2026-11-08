using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TeachersRating.API.Data;
using TeachersRating.API.Interfaces;
using TeachersRating.API.Services.Auth;

namespace TeachersRating.API.Endpoints.Admin.Auth;

public record AdminLoginDto(string Username, string Password);

public class AdminAuthEndpoints : IEndpoint
{
    public void MapEndpoint(IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("admin");

        group.MapPost("login", async (
            [FromBody] AdminLoginDto dto,
            [FromServices] AppDbContext context,
            HttpContext http) =>
        {
            var admin = await context.AdminUsers.FirstOrDefaultAsync(a => a.Username == (dto.Username ?? "").Trim());

            // Same response (and similar timing) for unknown user and wrong password.
            bool valid = admin is not null
                ? PasswordHasher.Verify(dto.Password ?? string.Empty, admin.PasswordHash)
                : PasswordHasher.Verify(dto.Password ?? string.Empty, DummyHash);

            if (!valid || admin is null)
            {
                return Results.Json(new { message = "Невірний логін або пароль" }, statusCode: StatusCodes.Status401Unauthorized);
            }

            admin.LastLoginAt = DateTime.UtcNow;
            await context.SaveChangesAsync();

            var identity = new ClaimsIdentity(
            [
                new Claim(ClaimTypes.NameIdentifier, admin.Id.ToString()),
                new Claim(ClaimTypes.Name, admin.Username),
                new Claim(ClaimTypes.Role, "Admin"),
                new Claim("pwd", admin.PasswordHash[^12..]), // invalidates sessions when the password changes
            ], CookieAuthenticationDefaults.AuthenticationScheme);

            await http.SignInAsync(CookieAuthenticationDefaults.AuthenticationScheme, new ClaimsPrincipal(identity),
                new AuthenticationProperties { IsPersistent = true });

            return Results.Ok(new { username = admin.Username });
        }).RequireRateLimiting("login");

        group.MapPost("logout", async (HttpContext http) =>
        {
            await http.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
            return Results.NoContent();
        });

        group.MapGet("me", (ClaimsPrincipal user) => Results.Ok(new { username = user.Identity?.Name }))
            .RequireAuthorization("Admin");
    }

    private static readonly string DummyHash = PasswordHasher.Hash(Guid.NewGuid().ToString());
}

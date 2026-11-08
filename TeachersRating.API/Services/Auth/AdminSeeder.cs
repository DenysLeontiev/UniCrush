using Microsoft.EntityFrameworkCore;
using TeachersRating.API.Data;
using TeachersRating.API.Entities;

namespace TeachersRating.API.Services.Auth;

/// <summary>
/// Keeps exactly one admin in the DB, matching appsettings "Admin:Username" / "Admin:Password".
/// Changing them in appsettings and restarting updates the account.
/// </summary>
public static class AdminSeeder
{
    public static async Task SeedAsync(AppDbContext context, IConfiguration configuration, ILogger logger)
    {
        string? username = configuration["Admin:Username"]?.Trim();
        string? password = configuration["Admin:Password"];

        if (string.IsNullOrWhiteSpace(username) || string.IsNullOrEmpty(password))
        {
            logger.LogWarning("Admin account not configured (Admin:Username / Admin:Password); dashboard login is disabled");
            return;
        }

        if (password.Length < 8)
        {
            logger.LogWarning("Admin:Password is shorter than 8 characters — please use a stronger password");
        }

        var admins = await context.AdminUsers.ToListAsync();
        var admin = admins.FirstOrDefault(a => a.Username == username) ?? admins.FirstOrDefault();

        if (admin is null)
        {
            admin = new AdminUser { Username = username, PasswordHash = PasswordHasher.Hash(password) };
            context.AdminUsers.Add(admin);
            logger.LogInformation("Admin account '{Username}' created", username);
        }
        else
        {
            if (admin.Username != username)
            {
                logger.LogInformation("Admin account renamed '{Old}' -> '{New}'", admin.Username, username);
                admin.Username = username;
            }

            if (!PasswordHasher.Verify(password, admin.PasswordHash))
            {
                admin.PasswordHash = PasswordHasher.Hash(password);
                logger.LogInformation("Admin password updated from appsettings");
            }
        }

        // One admin only.
        context.AdminUsers.RemoveRange(admins.Where(a => a != admin));

        await context.SaveChangesAsync();
    }
}

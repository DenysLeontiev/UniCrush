using System.Diagnostics;
using System.Security.Claims;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.EntityFrameworkCore;
using TeachersRating.API.BackgroundJobs;
using TeachersRating.API.Data;
using TeachersRating.API.Extensions;
using TeachersRating.API.Hubs;
using TeachersRating.API.Services.Auth;
using TeachersRating.API.Services.TeachersSync;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddOpenApi();

builder.Services.RegisterServices();

builder.Services.AddContinuousBackgroundService<TrackOnlineUsersIteration>();

builder.Services.RegisterDbContext(builder.Configuration);

builder.Services.AddEndpoints(typeof(Program).Assembly);

builder.Services.AddSignalR();

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAngularClient",
        policy =>
        {
            policy.WithOrigins(builder.Configuration["ClientUrl"]!)
                  .AllowAnyHeader()
                  .AllowAnyMethod()
                  .AllowCredentials();
        });
});

// The API runs behind Nginx (and Cloudflare Tunnel), so trust X-Forwarded-* headers
// to get the real scheme and client IP.
builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    options.KnownIPNetworks.Clear();
    options.KnownProxies.Clear();
});

// ---------- admin auth ----------

// Cookie encryption keys live in Postgres, so admin logins survive container rebuilds.
builder.Services.AddDataProtection()
    .SetApplicationName("UniCrush")
    .PersistKeysToDbContext<AppDbContext>();

builder.Services
    .AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
    .AddCookie(options =>
    {
        options.Cookie.Name = "uc_admin";
        options.Cookie.HttpOnly = true;
        options.Cookie.SameSite = SameSiteMode.Strict;
        options.Cookie.SecurePolicy = CookieSecurePolicy.SameAsRequest; // https via Cloudflare, http on LAN
        options.ExpireTimeSpan = TimeSpan.FromDays(14);
        options.SlidingExpiration = true;

        // API: answer 401/403 instead of redirecting to a login page.
        options.Events.OnRedirectToLogin = ctx => { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return Task.CompletedTask; };
        options.Events.OnRedirectToAccessDenied = ctx => { ctx.Response.StatusCode = StatusCodes.Status403Forbidden; return Task.CompletedTask; };

        // Log everyone out when the admin is removed or the password changes in appsettings.
        options.Events.OnValidatePrincipal = async ctx =>
        {
            var id = ctx.Principal?.FindFirstValue(ClaimTypes.NameIdentifier);
            var pwd = ctx.Principal?.FindFirstValue("pwd");
            var db = ctx.HttpContext.RequestServices.GetRequiredService<AppDbContext>();
            var admin = Guid.TryParse(id, out var adminId) ? await db.AdminUsers.AsNoTracking().FirstOrDefaultAsync(a => a.Id == adminId) : null;

            if (admin is null || pwd is null || !admin.PasswordHash.EndsWith(pwd, StringComparison.Ordinal))
            {
                ctx.RejectPrincipal();
            }
        };
    });

builder.Services.AddAuthorization(options =>
    options.AddPolicy("Admin", policy => policy.RequireAuthenticatedUser().RequireRole("Admin")));

builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

    static string ClientKey(HttpContext ctx) => ctx.Request.Headers["CF-Connecting-IP"].FirstOrDefault()
        ?? ctx.Connection.RemoteIpAddress?.ToString() ?? "unknown";

    // Brute-force protection for the admin login.
    options.AddPolicy("login", ctx => RateLimitPartition.GetFixedWindowLimiter(ClientKey(ctx),
        _ => new FixedWindowRateLimiterOptions { PermitLimit = 10, Window = TimeSpan.FromMinutes(5) }));

    // Analytics beacons.
    options.AddPolicy("track", ctx => RateLimitPartition.GetFixedWindowLimiter(ClientKey(ctx),
        _ => new FixedWindowRateLimiterOptions { PermitLimit = 120, Window = TimeSpan.FromMinutes(1) }));
});

var app = builder.Build();

app.UseForwardedHeaders();

await ApplyMigrationsAndSeedDataAsync(app.Services);

static async Task ApplyMigrationsAndSeedDataAsync(IServiceProvider services)
{
    using var scope = services.CreateScope();
    var scopedServices = scope.ServiceProvider;
    var logger = scopedServices.GetRequiredService<ILogger<Program>>();

    var context = scopedServices.GetRequiredService<AppDbContext>();

    // MigrateAsync is a no-op when there is nothing pending.
    await context.Database.MigrateAsync();

    await AdminSeeder.SeedAsync(context, scopedServices.GetRequiredService<IConfiguration>(), logger);

    // Sync teachers from the newest NulpScrapper output (first run = initial seed).
    // A failed sync must not take the site down, so it only logs.
    try
    {
        await scopedServices.GetRequiredService<TeachersSyncService>().SyncAsync();
    }
    catch (Exception ex)
    {
        logger.LogError(ex, "Teachers sync failed");
    }
}

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseCors("AllowAngularClient");

app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();

app.UseSwagger();
app.UseSwaggerUI();

// In Docker, TLS is terminated by Cloudflare; the container only speaks HTTP.
if (app.Environment.IsDevelopment())
{
    app.UseHttpsRedirection();
}

app.MapGet("/allocation", () =>
{
    var allocated = Process.GetCurrentProcess().PrivateMemorySize64 / 1024 / 1024;
    var workingSet = Process.GetCurrentProcess().WorkingSet64 / 1024 / 1024;
    var gcMemory = GC.GetTotalMemory(false) / 1024 / 1024;

    return Results.Ok($"allocated: {allocated} | workingSet: {workingSet} | gcMemory: {gcMemory}");
}).RequireAuthorization("Admin");

app.MapHub<PresenceHub>("/hubs/online");

RouteGroupBuilder apiPrefixGroup = app.MapGroup("api");

app.MapEndpoints(apiPrefixGroup);

app.Run();

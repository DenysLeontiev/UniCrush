using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.EntityFrameworkCore;
using System.Diagnostics;
using System.Text.Json.Serialization;
using TeachersRating.API.BackgroundJobs;
using TeachersRating.API.Data;
using TeachersRating.API.Extensions;
using TeachersRating.API.Hubs;
using TeachersRating.API.Seed;

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

var app = builder.Build();

app.UseForwardedHeaders();

await ApplyMigrationsAndSeedDataAsync(app.Services);

static async Task ApplyMigrationsAndSeedDataAsync(IServiceProvider services)
{
    using var scope = services.CreateScope();
    var scopedServices = scope.ServiceProvider;

    try
    {
        var context = scopedServices.GetRequiredService<AppDbContext>();

        // MigrateAsync is a no-op when there is nothing pending.
        await context.Database.MigrateAsync();

        await DataBaseSeeded.SeedDataAsync(context);
    }
    catch (Exception)
    {
        throw;
    }
}

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.MapGet("/allocation", () =>
{
    var allocated = Process.GetCurrentProcess()
                .PrivateMemorySize64 / 1024 / 1024;

    var workingSet = Process.GetCurrentProcess()
        .WorkingSet64 / 1024 / 1024;

    var gcMemory = GC.GetTotalMemory(false) / 1024 / 1024;

    return Results.Ok($"allocated: {allocated} | workingSet: {workingSet} | gcMemory: {gcMemory}");
});

app.UseCors("AllowAngularClient");

app.UseSwagger();
app.UseSwaggerUI();

// In Docker, TLS is terminated by Cloudflare; the container only speaks HTTP.
if (app.Environment.IsDevelopment())
{
    app.UseHttpsRedirection();
}

app.MapHub<PresenceHub>("/hubs/online");

RouteGroupBuilder apiPrefixGroup = app.MapGroup("api");

app.MapEndpoints(apiPrefixGroup);

app.Run();
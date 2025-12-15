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

var app = builder.Build();

await ApplyMigrationsAndSeedDataAsync(app.Services);

static async Task ApplyMigrationsAndSeedDataAsync(IServiceProvider services)
{
    using var scope = services.CreateScope();
    var scopedServices = scope.ServiceProvider;

    try
    {
        var context = scopedServices.GetRequiredService<AppDbContext>();

        var pendingMigrations = await context.Database.GetPendingMigrationsAsync();
        var pendingMigrationsList = pendingMigrations.ToList();

        if (pendingMigrationsList.Any())
        {
            await context.Database.MigrateAsync();
        }

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

app.UseHttpsRedirection();

app.MapHub<PresenceHub>("/hubs/online");

RouteGroupBuilder apiPrefixGroup = app.MapGroup("api");

app.MapEndpoints(apiPrefixGroup);

app.Run();

using System.Reflection;
using System.Reflection.Metadata;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection.Extensions;
using TeachersRating.API.BackgroundServices;
using TeachersRating.API.Data;
using TeachersRating.API.Interfaces;
using TeachersRating.API.Services;
using TeachersRating.API.Services.TeachersSync;

namespace TeachersRating.API.Extensions;

public static class ServicesExtentions
{
    public static IServiceCollection RegisterDbContext(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddDbContext<AppDbContext>((options) =>
        {
            string connectionString = configuration.GetConnectionString("DefaultConnection")
                ?? throw new ArgumentNullException("DataBase Connection String is null");

            options.UseNpgsql(connectionString, npgsql => npgsql.EnableRetryOnFailure(maxRetryCount: 5));

            // Comments/votes of soft-deleted (hidden) teachers are meant to be hidden with them.
            options.ConfigureWarnings(w => w.Ignore(
                Microsoft.EntityFrameworkCore.Diagnostics.CoreEventId.PossibleIncorrectRequiredNavigationWithQueryFilterInteractionWarning));
        });

        return services;
    }

    public static IServiceCollection AddEndpoints(this IServiceCollection services, Assembly assembly)
    {
        ServiceDescriptor[] serviceDescriptors = assembly
            .DefinedTypes
            .Where(type => type is { IsAbstract: false, IsInterface: false } &&
                           type.IsAssignableTo(typeof(IEndpoint)))
            .Select(type => ServiceDescriptor.Transient(typeof(IEndpoint), type))
            .ToArray();

        services.TryAddEnumerable(serviceDescriptors);

        return services;
    }

    public static IServiceCollection RegisterServices(this IServiceCollection services)
    {
        services.AddSingleton<IPresenceTrackerService, PresenceTrackerService>();
        services.AddSingleton<AppCalendar>();
        services.AddScoped<TeachersSyncService>();

        return services;
    }

    public static IServiceCollection AddContinuousBackgroundService<TIteration>(this IServiceCollection services)
        where TIteration : class, IContinuousWorkIteration
    {
        services.AddScoped<TIteration>();
        services.AddHostedService<ContinuousBackgroundService<TIteration>>();
        return services;
    }
}
using TeachersRating.API.Interfaces;

namespace TeachersRating.API.BackgroundServices;

public class ContinuousBackgroundService<TIteration> : BackgroundService where TIteration : IContinuousWorkIteration
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<ContinuousBackgroundService<TIteration>> _logger;

    public ContinuousBackgroundService(IServiceScopeFactory scopeFactory,
        ILogger<ContinuousBackgroundService<TIteration>> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await using var scope = _scopeFactory.CreateAsyncScope();
                var iteration = scope.ServiceProvider.GetRequiredService<TIteration>();

                await iteration.Run(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                // normal shutdown
                break;
            }
            catch (Exception ex)
            {
                await TIteration.OnException(ex, _logger);
            }
        }
    }
}
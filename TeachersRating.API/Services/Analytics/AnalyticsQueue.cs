using System.Threading.Channels;
using Microsoft.EntityFrameworkCore;
using TeachersRating.API.Data;
using TeachersRating.API.Entities;

namespace TeachersRating.API.Services.Analytics;

/// <summary>One browser batch, already validated and enriched (country, device…).</summary>
public record TrackBatch(string VisitorId, ClientInfo Client, List<AnalyticsEvent> Events);

/// <summary>
/// In-memory queue between /api/track and the database. The endpoint only enqueues and returns;
/// <see cref="AnalyticsWriter"/> writes everything in one transaction every couple of seconds.
/// </summary>
public class AnalyticsQueue
{
    // ~10k pending browser batches max; beyond that new batches are dropped (analytics must never hurt the site).
    private readonly Channel<TrackBatch> _channel = Channel.CreateBounded<TrackBatch>(new BoundedChannelOptions(10_000)
    {
        FullMode = BoundedChannelFullMode.DropWrite,
        SingleReader = true,
        SingleWriter = false,
    });

    public bool TryEnqueue(TrackBatch batch) => _channel.Writer.TryWrite(batch);

    public ChannelReader<TrackBatch> Reader => _channel.Reader;
}

/// <summary>Background job: drains the queue every <see cref="FlushInterval"/> and bulk-inserts.</summary>
public class AnalyticsWriter : BackgroundService
{
    private static readonly TimeSpan FlushInterval = TimeSpan.FromSeconds(2);
    private const int MaxEventsPerFlush = 5_000;

    private readonly AnalyticsQueue _queue;
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<AnalyticsWriter> _logger;

    public AnalyticsWriter(AnalyticsQueue queue, IServiceScopeFactory scopeFactory, ILogger<AnalyticsWriter> logger)
    {
        _queue = queue;
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var reader = _queue.Reader;

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                // Sleep until something arrives, then give the batch a moment to fill up.
                if (!await reader.WaitToReadAsync(stoppingToken)) break;
                await Task.Delay(FlushInterval, stoppingToken);
            }
            catch (OperationCanceledException)
            {
                break;
            }

            await DrainAsync(CancellationToken.None);
        }

        // Shutdown: write whatever is still queued.
        await DrainAsync(CancellationToken.None);
    }

    private async Task DrainAsync(CancellationToken cancellationToken)
    {
        while (true)
        {
            var batches = new List<TrackBatch>();
            int events = 0;

            while (events < MaxEventsPerFlush && _queue.Reader.TryRead(out var batch))
            {
                batches.Add(batch);
                events += batch.Events.Count;
            }

            if (batches.Count == 0) return;

            try
            {
                await WriteAsync(batches, cancellationToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to write {Count} analytics events", events);
                return;
            }
        }
    }

    private async Task WriteAsync(List<TrackBatch> batches, CancellationToken cancellationToken)
    {
        await using var scope = _scopeFactory.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var ids = batches.Select(b => b.VisitorId).Distinct().ToList();
        var visitors = await db.Visitors.Where(v => ids.Contains(v.Id)).ToDictionaryAsync(v => v.Id, cancellationToken);

        foreach (var batch in batches)
        {
            var firstAt = batch.Events.Min(e => e.OccurredAt);
            var lastAt = batch.Events.Max(e => e.OccurredAt);

            if (!visitors.TryGetValue(batch.VisitorId, out var visitor))
            {
                visitor = new Visitor { Id = batch.VisitorId, FirstSeenAt = firstAt, LastSeenAt = lastAt };
                db.Visitors.Add(visitor);
                visitors[batch.VisitorId] = visitor;
            }

            if (firstAt < visitor.FirstSeenAt) visitor.FirstSeenAt = firstAt;
            if (lastAt > visitor.LastSeenAt) visitor.LastSeenAt = lastAt;
            visitor.Country = batch.Client.Country;
            visitor.Device = batch.Client.Device;
            visitor.Os = batch.Client.Os;
            visitor.Browser = batch.Client.Browser;

            db.AnalyticsEvents.AddRange(batch.Events);
        }

        // One SaveChanges = one transaction; EF batches the INSERTs into a few round-trips.
        await db.SaveChangesAsync(cancellationToken);
    }
}

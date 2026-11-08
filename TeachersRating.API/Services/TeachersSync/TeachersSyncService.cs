using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using TeachersRating.API.Data;
using TeachersRating.API.Entities;

namespace TeachersRating.API.Services.TeachersSync;

/// <summary>
/// Brings institutes / departments / teachers in the DB in line with the NulpScrapper output.
///
/// - Matching keys: institute href, department href, teacher personal page URL.
/// - New ones are added, changed names/positions/photos are updated.
/// - Ones that are no longer on lpnu.ua are soft-deleted (hidden), so their likes and comments
///   are kept and come back if they reappear.
/// - Runs on every API start; it is idempotent, so an unchanged file changes nothing.
/// </summary>
public class TeachersSyncService
{
    private readonly AppDbContext _context;
    private readonly IConfiguration _configuration;
    private readonly ILogger<TeachersSyncService> _logger;

    public TeachersSyncService(AppDbContext context, IConfiguration configuration, ILogger<TeachersSyncService> logger)
    {
        _context = context;
        _configuration = configuration;
        _logger = logger;
    }

    public async Task SyncAsync(CancellationToken cancellationToken = default)
    {
        string? filePath = ResolveFile();

        if (filePath is null)
        {
            _logger.LogWarning("Teachers sync skipped: none of TeachersImport:FilePaths exists");
            return;
        }

        var rows = await ReadRowsAsync(filePath, cancellationToken);

        if (rows.Count == 0)
        {
            _logger.LogWarning("Teachers sync skipped: {File} has no usable rows", filePath);
            return;
        }

        var incomingInstitutes = rows
            .GroupBy(r => r.department!.institute!.href!)
            .ToDictionary(g => g.Key, g => g.First().department!.institute!);

        var incomingDepartments = rows
            .GroupBy(r => r.department!.href!)
            .ToDictionary(g => g.Key, g => g.First().department!);

        var incomingWorkers = rows
            .GroupBy(r => r.personalPageHref!)
            .ToDictionary(g => g.Key, g => (Row: g.First(), DepartmentHrefs: g.Select(x => x.department!.href!).ToHashSet()));

        int activeWorkers = await _context.Workers.CountAsync(cancellationToken);
        double minKeepRatio = _configuration.GetValue("TeachersImport:MinKeepRatio", 0.7);

        if (activeWorkers > 0 && incomingWorkers.Count < activeWorkers * minKeepRatio)
        {
            _logger.LogError(
                "Teachers sync aborted: {File} has {Incoming} teachers but the DB has {Active} active ones " +
                "(less than {Ratio:P0}). Looks like a partial scrape; nothing was changed.",
                filePath, incomingWorkers.Count, activeWorkers, minKeepRatio);
            return;
        }

        var stats = new SyncStats();

        var institutesByHref = await SyncInstitutesAsync(incomingInstitutes, stats, cancellationToken);
        var departmentsByHref = await SyncDepartmentsAsync(incomingDepartments, institutesByHref, stats, cancellationToken);
        await SyncWorkersAsync(incomingWorkers, departmentsByHref, stats, cancellationToken);

        await _context.SaveChangesAsync(cancellationToken);

        _logger.LogInformation(
            "Teachers sync from {File}: institutes +{InstAdded} ~{InstUpdated} -{InstRemoved}; " +
            "departments +{DepAdded} ~{DepUpdated} -{DepRemoved}; teachers +{WAdded} ~{WUpdated} -{WRemoved} (merged duplicates: {WMerged}); " +
            "now {Total} active teachers",
            filePath,
            stats.InstitutesAdded, stats.InstitutesUpdated, stats.InstitutesRemoved,
            stats.DepartmentsAdded, stats.DepartmentsUpdated, stats.DepartmentsRemoved,
            stats.WorkersAdded, stats.WorkersUpdated, stats.WorkersRemoved, stats.WorkersMerged,
            incomingWorkers.Count);
    }

    private string? ResolveFile()
    {
        var candidates = _configuration.GetSection("TeachersImport:FilePaths").Get<string[]>() ?? [];

        // Newest file wins: a fresh scrape in the shared volume beats the seed bundled in the image.
        return candidates
            .Select(p => Path.GetFullPath(p, Directory.GetCurrentDirectory()))
            .Where(File.Exists)
            .OrderByDescending(File.GetLastWriteTimeUtc)
            .FirstOrDefault();
    }

    private async Task<List<TeacherJsonModel>> ReadRowsAsync(string filePath, CancellationToken cancellationToken)
    {
        await using var stream = File.OpenRead(filePath);

        var rows = await JsonSerializer.DeserializeAsync<List<TeacherJsonModel>>(
            stream, new JsonSerializerOptions { PropertyNameCaseInsensitive = true }, cancellationToken) ?? [];

        var usable = rows
            .Where(r => !string.IsNullOrWhiteSpace(r.fullName)
                        && !string.IsNullOrWhiteSpace(r.personalPageHref)
                        && !string.IsNullOrWhiteSpace(r.department?.href)
                        && !string.IsNullOrWhiteSpace(r.department?.institute?.href))
            .ToList();

        foreach (var row in usable)
        {
            row.personalPageHref = row.personalPageHref!.Trim();
            row.department!.href = row.department.href!.Trim();
            row.department.institute!.href = row.department.institute.href!.Trim();
        }

        if (usable.Count < rows.Count)
        {
            _logger.LogWarning("Teachers sync: skipped {Count} rows without name / personal page / department", rows.Count - usable.Count);
        }

        return usable;
    }

    private async Task<Dictionary<string, Institute>> SyncInstitutesAsync(
        Dictionary<string, InstituteJsonModel> incoming, SyncStats stats, CancellationToken cancellationToken)
    {
        var existing = await _context.Institutes.IgnoreQueryFilters().ToListAsync(cancellationToken);
        var byHref = new Dictionary<string, Institute>();

        foreach (var institute in existing)
        {
            if (!byHref.TryAdd(institute.InstituteUrl, institute))
            {
                institute.IsDeleted = true; // duplicate row
            }
        }

        foreach (var (href, data) in incoming)
        {
            string name = data.name?.Trim() is { Length: > 0 } n ? n : "Невідомий інститут";

            if (byHref.TryGetValue(href, out var institute))
            {
                if (institute.Name != name || institute.IsDeleted)
                {
                    institute.Name = name;
                    institute.IsDeleted = false;
                    stats.InstitutesUpdated++;
                }
            }
            else
            {
                institute = new Institute { Name = name, InstituteUrl = href };
                _context.Institutes.Add(institute);
                byHref[href] = institute;
                stats.InstitutesAdded++;
            }
        }

        foreach (var (href, institute) in byHref)
        {
            if (!incoming.ContainsKey(href) && !institute.IsDeleted)
            {
                institute.IsDeleted = true;
                stats.InstitutesRemoved++;
            }
        }

        return byHref;
    }

    private async Task<Dictionary<string, Department>> SyncDepartmentsAsync(
        Dictionary<string, DepartmentJsonModel> incoming,
        Dictionary<string, Institute> institutesByHref,
        SyncStats stats,
        CancellationToken cancellationToken)
    {
        var existing = await _context.Departments.IgnoreQueryFilters().ToListAsync(cancellationToken);
        var byHref = new Dictionary<string, Department>();

        foreach (var department in existing)
        {
            if (!byHref.TryAdd(department.DepartmentUrl, department))
            {
                department.IsDeleted = true; // duplicate row
            }
        }

        foreach (var (href, data) in incoming)
        {
            var institute = institutesByHref[data.institute!.href!];
            string longName = data.longName?.Trim() is { Length: > 0 } l ? l : "Невідома кафедра";
            string shortName = data.shortName?.Trim() ?? string.Empty;
            string workersPageUrl = data.workersPageHref?.Trim() ?? string.Empty;

            if (byHref.TryGetValue(href, out var department))
            {
                if (department.LongName != longName || department.ShortName != shortName ||
                    department.WorkersPageUrl != workersPageUrl || department.InstituteId != institute.Id ||
                    department.IsDeleted)
                {
                    department.LongName = longName;
                    department.ShortName = shortName;
                    department.WorkersPageUrl = workersPageUrl;
                    department.InstituteId = institute.Id;
                    department.Institute = institute;
                    department.IsDeleted = false;
                    stats.DepartmentsUpdated++;
                }
            }
            else
            {
                department = new Department
                {
                    InstituteId = institute.Id,
                    Institute = institute,
                    LongName = longName,
                    ShortName = shortName,
                    DepartmentUrl = href,
                    WorkersPageUrl = workersPageUrl,
                };
                _context.Departments.Add(department);
                byHref[href] = department;
                stats.DepartmentsAdded++;
            }
        }

        foreach (var (href, department) in byHref)
        {
            if (!incoming.ContainsKey(href) && !department.IsDeleted)
            {
                department.IsDeleted = true;
                stats.DepartmentsRemoved++;
            }
        }

        return byHref;
    }

    private async Task SyncWorkersAsync(
        Dictionary<string, (TeacherJsonModel Row, HashSet<string> DepartmentHrefs)> incoming,
        Dictionary<string, Department> departmentsByHref,
        SyncStats stats,
        CancellationToken cancellationToken)
    {
        var existing = await _context.Workers
            .IgnoreQueryFilters()
            .Include(w => w.Photo)
            .Include(w => w.Departments)
            .ToListAsync(cancellationToken);

        var byHref = new Dictionary<string, Worker>();

        // Older data had one teacher row per department; merge those into one teacher.
        foreach (var group in existing.GroupBy(w => w.PersonalPageUrl))
        {
            var ordered = group
                .OrderBy(w => w.IsDeleted)
                .ThenByDescending(w => (long)w.NumberOfLikes + w.NumberOfDislikes)
                .ThenBy(w => w.DateCreated)
                .ToList();

            var canonical = ordered[0];
            byHref[group.Key] = canonical;

            foreach (var duplicate in ordered.Skip(1))
            {
                if (!duplicate.IsDeleted)
                {
                    stats.WorkersMerged++;
                }

                canonical.NumberOfLikes += duplicate.NumberOfLikes;
                canonical.NumberOfDislikes += duplicate.NumberOfDislikes;
                duplicate.NumberOfLikes = 0;
                duplicate.NumberOfDislikes = 0;
                duplicate.IsDeleted = true;

                await _context.Comments.Where(c => c.WorkerId == duplicate.Id)
                    .ExecuteUpdateAsync(s => s.SetProperty(c => c.WorkerId, canonical.Id), cancellationToken);
                await _context.WorkerVotes.Where(v => v.WorkerId == duplicate.Id)
                    .ExecuteUpdateAsync(s => s.SetProperty(v => v.WorkerId, canonical.Id), cancellationToken);
            }
        }

        foreach (var (href, (row, departmentHrefs)) in incoming)
        {
            string fullName = Clean(row.fullName);
            string position = Clean(row.position);
            string photoUrl = row.imageUrl?.Trim() ?? string.Empty;

            var targetDepartments = departmentHrefs.Select(h => departmentsByHref[h]).ToList();

            if (byHref.TryGetValue(href, out var worker))
            {
                bool changed = worker.IsDeleted || worker.FullName != fullName || worker.Position != position;

                worker.IsDeleted = false;
                worker.FullName = fullName;
                worker.Position = position;

                if (worker.Photo is null)
                {
                    var photo = new Photo { WorkerId = worker.Id, Url = photoUrl };
                    _context.Photos.Add(photo);
                    worker.Photo = photo;
                    worker.PhotoId = photo.Id;
                    changed = true;
                }
                else if (worker.Photo.Url != photoUrl)
                {
                    worker.Photo.Url = photoUrl;
                    changed = true;
                }

                changed |= SyncDepartmentLinks(worker, targetDepartments);

                if (changed)
                {
                    stats.WorkersUpdated++;
                }
            }
            else
            {
                worker = new Worker
                {
                    FullName = fullName,
                    Position = position,
                    PersonalPageUrl = href,
                };

                var photo = new Photo { WorkerId = worker.Id, Url = photoUrl };
                worker.PhotoId = photo.Id;
                worker.Photo = photo;

                foreach (var department in targetDepartments)
                {
                    worker.Departments.Add(department);
                }

                _context.Photos.Add(photo);
                _context.Workers.Add(worker);
                byHref[href] = worker;
                stats.WorkersAdded++;
            }
        }

        foreach (var (href, worker) in byHref)
        {
            if (!incoming.ContainsKey(href) && !worker.IsDeleted)
            {
                worker.IsDeleted = true;
                stats.WorkersRemoved++;
            }
        }
    }

    /// <summary>Collapses lpnu.ua's stray line breaks / double spaces.</summary>
    private static string Clean(string? value) =>
        string.Join(' ', (value ?? string.Empty).Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries));

    private static bool SyncDepartmentLinks(Worker worker, List<Department> target)
    {
        var targetIds = target.Select(d => d.Id).ToHashSet();
        var toRemove = worker.Departments.Where(d => !targetIds.Contains(d.Id)).ToList();
        var currentIds = worker.Departments.Select(d => d.Id).ToHashSet();
        var toAdd = target.Where(d => !currentIds.Contains(d.Id)).ToList();

        foreach (var department in toRemove)
        {
            worker.Departments.Remove(department);
        }

        foreach (var department in toAdd)
        {
            worker.Departments.Add(department);
        }

        return toRemove.Count > 0 || toAdd.Count > 0;
    }

    private sealed class SyncStats
    {
        public int InstitutesAdded, InstitutesUpdated, InstitutesRemoved;
        public int DepartmentsAdded, DepartmentsUpdated, DepartmentsRemoved;
        public int WorkersAdded, WorkersUpdated, WorkersRemoved, WorkersMerged;
    }
}

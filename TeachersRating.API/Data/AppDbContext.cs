using Microsoft.AspNetCore.DataProtection.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using TeachersRating.API.Entities;

namespace TeachersRating.API.Data;

public class AppDbContext : DbContext, IDataProtectionKeyContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<Department> Departments { get; set; }
    public DbSet<Institute> Institutes { get; set; }
    public DbSet<Worker> Workers { get; set; }
    public DbSet<Photo> Photos { get; set; }
    public DbSet<UsersOnlineStat> UsersOnlineStats { get; set; }
    public DbSet<Comment> Comments { get; set; }
    public DbSet<WorkerVote> WorkerVotes { get; set; }

    // admin + analytics
    public DbSet<AdminUser> AdminUsers { get; set; }
    public DbSet<Visitor> Visitors { get; set; }
    public DbSet<AnalyticsEvent> AnalyticsEvents { get; set; }

    /// <summary>ASP.NET Data Protection key ring (keeps admin logins valid across redeploys).</summary>
    public DbSet<DataProtectionKey> DataProtectionKeys { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        // Institutes/departments/teachers that disappear from the scraped list are soft-deleted
        // (so their likes and comments survive and come back if they reappear). Hide them everywhere.
        modelBuilder.Entity<Institute>().HasQueryFilter(x => !x.IsDeleted);
        modelBuilder.Entity<Department>().HasQueryFilter(x => !x.IsDeleted);
        modelBuilder.Entity<Worker>().HasQueryFilter(x => !x.IsDeleted);

        // Comments hidden by the admin (moderation) disappear from the public site.
        modelBuilder.Entity<Comment>().HasQueryFilter(x => !x.IsDeleted);

        modelBuilder.Entity<AdminUser>().HasIndex(x => x.Username).IsUnique();
        modelBuilder.Entity<AdminUser>().Property(x => x.Username).HasMaxLength(64);

        modelBuilder.Entity<Visitor>(b =>
        {
            b.Property(x => x.Id).HasMaxLength(64);
            b.Property(x => x.Country).HasMaxLength(2);
            b.Property(x => x.Device).HasMaxLength(16);
            b.Property(x => x.Os).HasMaxLength(32);
            b.Property(x => x.Browser).HasMaxLength(32);
            b.HasIndex(x => x.FirstSeenAt);
        });

        modelBuilder.Entity<AnalyticsEvent>(b =>
        {
            b.Property(x => x.VisitorId).HasMaxLength(64);
            b.Property(x => x.SessionId).HasMaxLength(64);
            b.Property(x => x.Type).HasMaxLength(32);
            b.Property(x => x.Page).HasMaxLength(32);
            b.Property(x => x.Path).HasMaxLength(200);
            b.Property(x => x.Value).HasMaxLength(200);
            b.Property(x => x.Country).HasMaxLength(2);
            b.Property(x => x.Device).HasMaxLength(16);
            b.Property(x => x.Os).HasMaxLength(32);
            b.Property(x => x.Browser).HasMaxLength(32);
            b.Property(x => x.Theme).HasMaxLength(8);
            b.Property(x => x.Language).HasMaxLength(16);
            b.Property(x => x.Referrer).HasMaxLength(100);
            b.Property(x => x.UtmSource).HasMaxLength(64);
            b.Property(x => x.UtmMedium).HasMaxLength(64);
            b.Property(x => x.UtmCampaign).HasMaxLength(64);
            b.HasIndex(x => x.OccurredAt);
            b.HasIndex(x => new { x.Type, x.OccurredAt });
            b.HasIndex(x => new { x.VisitorId, x.OccurredAt });
            b.HasIndex(x => x.SessionId);
        });

        modelBuilder.Entity<Worker>().HasIndex(x => x.PersonalPageUrl);
        modelBuilder.Entity<Institute>().HasIndex(x => x.InstituteUrl);
        modelBuilder.Entity<Department>().HasIndex(x => x.DepartmentUrl);

        modelBuilder.Entity<Comment>()
            .Property(x => x.AuthorName)
            .HasMaxLength(40);

        modelBuilder.Entity<WorkerVote>()
            .HasOne(x => x.Worker)
            .WithMany(x => x.Votes)
            .HasForeignKey(x => x.WorkerId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<WorkerVote>()
            .HasIndex(x => new { x.DateCreated, x.WorkerId });

        modelBuilder.Entity<Worker>()
            .HasOne(w => w.Photo)
            .WithOne(p => p.Worker)
            .HasForeignKey<Worker>(w => w.PhotoId);

        modelBuilder.Entity<Comment>()
            .HasOne(x => x.ParentComment)
            .WithMany(x => x.Replies)
            .HasForeignKey(x => x.ParentCommentId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<UsersOnlineStat>()
            .HasIndex(x => x.DateCreated);

        base.OnModelCreating(modelBuilder);
    }

    public override int SaveChanges()
    {
        UpdateBaseEntityCommonDateTimeFields();
        return base.SaveChanges();
    }

    public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        UpdateBaseEntityCommonDateTimeFields();
        return base.SaveChangesAsync(cancellationToken);
    }

    private void UpdateBaseEntityCommonDateTimeFields()
    {
        DateTime now = DateTime.UtcNow;

        foreach (var entry in ChangeTracker.Entries<BaseEntity>())
        {
            if (entry.State == EntityState.Added)
            {
                entry.Entity.DateCreated = now;
                entry.Entity.DateModified = now;
            }
            else if (entry.State == EntityState.Modified)
            {
                entry.Entity.DateModified = now;
            }
        }
    }
}
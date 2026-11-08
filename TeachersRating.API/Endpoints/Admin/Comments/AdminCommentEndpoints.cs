using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TeachersRating.API.Data;
using TeachersRating.API.DataStructures;
using TeachersRating.API.Interfaces;

namespace TeachersRating.API.Endpoints.Admin.Comments;

public class AdminCommentDto
{
    public Guid Id { get; set; }
    public string Content { get; set; } = string.Empty;
    public string? AuthorName { get; set; }
    public DateTime DateCreated { get; set; }
    public bool IsHidden { get; set; }
    public Guid? ParentCommentId { get; set; }
    public string? ParentContent { get; set; }
    public int RepliesCount { get; set; }
    public Guid WorkerId { get; set; }
    public string WorkerName { get; set; } = string.Empty;
}

public class AdminCommentsQuery
{
    public string? Search { get; set; }
    /// <summary>all | visible | hidden</summary>
    public string? Status { get; set; }
    public int? PageNumber { get; set; }
    public int? PageSize { get; set; }
}

/// <summary>Comment moderation: list, hide (soft), restore, delete permanently.</summary>
public class AdminCommentEndpoints : IEndpoint
{
    public void MapEndpoint(IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("admin/comments").RequireAuthorization("Admin");

        group.MapGet("", async ([AsParameters] AdminCommentsQuery query, [FromServices] AppDbContext db) =>
        {
            int pageNumber = Math.Max(1, query.PageNumber ?? 1);
            int pageSize = Math.Clamp(query.PageSize ?? 20, 1, 100);

            var comments = db.Comments.IgnoreQueryFilters().AsNoTracking();

            comments = query.Status switch
            {
                "hidden" => comments.Where(c => c.IsDeleted),
                "visible" => comments.Where(c => !c.IsDeleted),
                _ => comments,
            };

            if (!string.IsNullOrWhiteSpace(query.Search))
            {
                string pattern = $"%{query.Search.Trim().Replace("\\", "\\\\").Replace("%", "\\%").Replace("_", "\\_")}%";
                comments = comments.Where(c =>
                    EF.Functions.ILike(c.Content, pattern, "\\") ||
                    (c.AuthorName != null && EF.Functions.ILike(c.AuthorName, pattern, "\\")) ||
                    EF.Functions.ILike(c.Worker!.FullName, pattern, "\\"));
            }

            int total = await comments.CountAsync();

            var items = await comments
                .OrderByDescending(c => c.DateCreated)
                .Skip((pageNumber - 1) * pageSize)
                .Take(pageSize)
                .Select(c => new AdminCommentDto
                {
                    Id = c.Id,
                    Content = c.Content,
                    AuthorName = c.AuthorName,
                    DateCreated = c.DateCreated,
                    IsHidden = c.IsDeleted,
                    ParentCommentId = c.ParentCommentId,
                    ParentContent = c.ParentComment != null ? c.ParentComment.Content : null,
                    RepliesCount = c.Replies.Count,
                    WorkerId = c.WorkerId,
                    WorkerName = c.Worker != null ? c.Worker.FullName : "—",
                })
                .ToListAsync();

            return Results.Ok(new PaginatedList<AdminCommentDto>(items, total, pageNumber, pageSize));
        });

        group.MapPost("{id:guid}/hide", (Guid id, [FromServices] AppDbContext db) => SetHiddenAsync(db, id, true));
        group.MapPost("{id:guid}/restore", (Guid id, [FromServices] AppDbContext db) => SetHiddenAsync(db, id, false));

        group.MapDelete("{id:guid}", async (Guid id, [FromServices] AppDbContext db) =>
        {
            var comment = await db.Comments.IgnoreQueryFilters()
                .Include(c => c.Replies)
                .FirstOrDefaultAsync(c => c.Id == id);

            if (comment is null) return Results.NotFound();

            db.Comments.RemoveRange(comment.Replies);
            db.Comments.Remove(comment);
            await db.SaveChangesAsync();
            return Results.NoContent();
        });
    }

    private static async Task<IResult> SetHiddenAsync(AppDbContext db, Guid id, bool hidden)
    {
        int updated = await db.Comments.IgnoreQueryFilters()
            .Where(c => c.Id == id)
            .ExecuteUpdateAsync(s => s.SetProperty(c => c.IsDeleted, hidden));

        return updated == 0 ? Results.NotFound() : Results.NoContent();
    }
}

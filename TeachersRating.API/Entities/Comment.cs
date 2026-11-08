namespace TeachersRating.API.Entities;

public class Comment : BaseEntity
{
    public string Content { get; set; } = "";

    /// <summary>Optional display name the author typed (forum style). Null = anonymous.</summary>
    public string? AuthorName { get; set; }

    public Guid WorkerId { get; set; }
    public Worker? Worker { get; set; } = null;

    public Guid? ParentCommentId { get; set; }
    public Comment? ParentComment { get; set; }

    public ICollection<Comment> Replies { get; set; } = new List<Comment>();
}
namespace TeachersRating.API.DTOs;

public class CommentDto
{
    public Guid Id { get; set; }
    public DateTime DateCreated { get; set; }
    public DateTime DateModified { get; set; }
    public string Content { get; set; } = string.Empty;
    public string? AuthorName { get; set; }
    public Guid WorkerId { get; set; }
    public Guid? ParentCommentId { get; set; }
    public int NumberOfReplies { get; set; }
}
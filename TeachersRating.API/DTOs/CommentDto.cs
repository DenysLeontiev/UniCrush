namespace TeachersRating.API.DTOs;

public class CommentDto
{
    public Guid Id { get; set; }
    public DateTime DateCreated { get; set; }
    public DateTime DateModified { get; set; }
    public string Content { get; set; } = string.Empty;
    public Guid WorkerId { get; set; }
    public Guid? ParentCommentId { get; set; }
}
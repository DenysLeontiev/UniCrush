namespace TeachersRating.API.Endpoints.Comment.Command.AddCommentToWorkerCommand;

public class AddCommentDto
{
    public string Content { get; set; } = string.Empty;
    public string? AuthorName { get; set; }
    public Guid? ParentCommentId { get; set; }    
}
namespace TeachersRating.API.Endpoints.Comment.Command.AddCommentToWorkerCommand;

public class AddCommentDto
{
    public string Content { get; set; } = string.Empty;
    public Guid? ParentCommentId { get; set; }    
}
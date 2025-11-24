namespace TeachersRating.API.Entities;

public class Comment : BaseEntity
{
    public string Content { get; set; } = "";

    public Guid WorkerId { get; set; }
    public Worker? Worker { get; set; } = null;
}
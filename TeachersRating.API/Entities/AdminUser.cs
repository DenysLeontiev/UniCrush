namespace TeachersRating.API.Entities;

/// <summary>Dashboard admin. Seeded/updated from appsettings "Admin" section on every start.</summary>
public class AdminUser : BaseEntity
{
    public string Username { get; set; } = string.Empty;

    /// <summary>PBKDF2 hash, see Services/Auth/PasswordHasher.</summary>
    public string PasswordHash { get; set; } = string.Empty;

    public DateTime? LastLoginAt { get; set; }
}

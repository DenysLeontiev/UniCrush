using TeachersRating.API.DTOs;
using TeachersRating.API.Entities;

namespace TeachersRating.API.Extensions;

public static class EntityMappingExtensions
{
    public static InstituteDto ToDto(this Institute institute)
    {
        return new InstituteDto
        {
            Id = institute.Id,
            Name = institute.Name,
            InstituteUrl = institute.InstituteUrl,
            Departments = institute.Departments
                .Select(d => new DepartmentDto
                {
                    Id = d.Id,
                    LongName = d.LongName,
                    ShortName = d.ShortName,
                    DepartmentUrl = d.DepartmentUrl,
                    WorkersPageUrl = d.WorkersPageUrl,
                    Institute = new InstituteSimpleDto
                    {
                        Id = institute.Id,
                        Name = institute.Name,
                        InstituteUrl = institute.InstituteUrl
                    },
                    Workers = d.Workers
                        .Select(w => new WorkerSimpleDto
                        {
                            Id = w.Id,
                            FullName = w.FullName,
                            Position = w.Position
                        })
                        .ToList()
                })
                .ToList()
        };
    }

    public static InstituteSimpleDto ToSimpleDto(this Institute institute)
    {
        return new InstituteSimpleDto
        {
            Id = institute.Id,
            Name = institute.Name,
            InstituteUrl = institute.InstituteUrl
        };
    }

    public static DepartmentDto ToDto(this Department department)
    {
        return new DepartmentDto
        {
            Id = department.Id,
            LongName = department.LongName,
            ShortName = department.ShortName,
            DepartmentUrl = department.DepartmentUrl,
            WorkersPageUrl = department.WorkersPageUrl,
            Institute = department.Institute?.ToSimpleDto() ?? new InstituteSimpleDto(),
            Workers = department.Workers
                .Select(w => new WorkerSimpleDto
                {
                    Id = w.Id,
                    FullName = w.FullName,
                    Position = w.Position
                })
                .ToList()
        };
    }

    public static DepartmentSimpleDto ToSimpleDto(this Department department)
    {
        return new DepartmentSimpleDto
        {
            Id = department.Id,
            LongName = department.LongName,
            ShortName = department.ShortName,
            DepartmentUrl = department.DepartmentUrl
        };
    }

    public static WorkerDto ToDto(this Worker worker)
    {
        return new WorkerDto
        {
            Id = worker.Id,
            FullName = worker.FullName,
            Position = worker.Position,
            PersonalPageUrl = worker.PersonalPageUrl,
            Photo = worker.Photo?.ToDto() ?? new PhotoDto(),
            NumberOfLikes = worker.NumberOfLikes,
            NumberOfDislikes = worker.NumberOfDislikes,
            NumberOfComments = worker.NumberOfComments,
            Departments = worker.Departments
                .Select(d => new DepartmentSimpleDto
                {
                    Id = d.Id,
                    LongName = d.LongName,
                    ShortName = d.ShortName,
                    DepartmentUrl = d.DepartmentUrl
                })
                .ToList()
        };
    }

    public static WorkerSimpleDto ToSimpleDto(this Worker worker)
    {
        return new WorkerSimpleDto
        {
            Id = worker.Id,
            FullName = worker.FullName,
            Position = worker.Position,
            NumberOfLikes = worker.NumberOfLikes,
            NumberOfDislikes = worker.NumberOfDislikes
        };
    }

    public static PhotoDto ToDto(this Photo photo)
    {
        return new PhotoDto
        {
            Id = photo.Id,
            Url = photo.Url
        };
    }

    public static UsersOnlineStatDto ToDto(this UsersOnlineStat usersOnlineStat)
    {
        return new UsersOnlineStatDto
        {
            Id = usersOnlineStat.Id,
            NumberOfOnlineUsers = usersOnlineStat.NumberOfOnlineUsers,
            DateCreated = usersOnlineStat.DateCreated,
            DateModified = usersOnlineStat.DateModified,
            IsDeleted = usersOnlineStat.IsDeleted
        };
    }

    public static CommentDto ToDto(this Comment comment)
    {
        return new CommentDto
        {
            Id = comment.Id,
            Content = comment.Content,
            DateCreated = comment.DateCreated,
            DateModified = comment.DateModified,
            WorkerId = comment.WorkerId,
            ParentCommentId = comment.ParentCommentId,
            NumberOfReplies = comment.Replies.Count
        };
    }
}
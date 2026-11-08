using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TeachersRating.API.Data.Migrations
{
    /// <inheritdoc />
    public partial class VotesLeaderboardAndSync : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "WorkerVotes",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    WorkerId = table.Column<Guid>(type: "uuid", nullable: false),
                    IsLike = table.Column<bool>(type: "boolean", nullable: false),
                    DateCreated = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    DateModified = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_WorkerVotes", x => x.Id);
                    table.ForeignKey(
                        name: "FK_WorkerVotes_Workers_WorkerId",
                        column: x => x.WorkerId,
                        principalTable: "Workers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Workers_PersonalPageUrl",
                table: "Workers",
                column: "PersonalPageUrl");

            migrationBuilder.CreateIndex(
                name: "IX_Institutes_InstituteUrl",
                table: "Institutes",
                column: "InstituteUrl");

            migrationBuilder.CreateIndex(
                name: "IX_Departments_DepartmentUrl",
                table: "Departments",
                column: "DepartmentUrl");

            migrationBuilder.CreateIndex(
                name: "IX_WorkerVotes_DateCreated_WorkerId",
                table: "WorkerVotes",
                columns: new[] { "DateCreated", "WorkerId" });

            migrationBuilder.CreateIndex(
                name: "IX_WorkerVotes_WorkerId",
                table: "WorkerVotes",
                column: "WorkerId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "WorkerVotes");

            migrationBuilder.DropIndex(
                name: "IX_Workers_PersonalPageUrl",
                table: "Workers");

            migrationBuilder.DropIndex(
                name: "IX_Institutes_InstituteUrl",
                table: "Institutes");

            migrationBuilder.DropIndex(
                name: "IX_Departments_DepartmentUrl",
                table: "Departments");
        }
    }
}

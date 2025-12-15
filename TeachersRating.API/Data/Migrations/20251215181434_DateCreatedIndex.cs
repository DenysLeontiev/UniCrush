using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TeachersRating.API.Data.Migrations
{
    /// <inheritdoc />
    public partial class DateCreatedIndex : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateIndex(
                name: "IX_UsersOnlineStats_DateCreated",
                table: "UsersOnlineStats",
                column: "DateCreated");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_UsersOnlineStats_DateCreated",
                table: "UsersOnlineStats");
        }
    }
}

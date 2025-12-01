using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TeachersRating.API.Data.Migrations
{
    /// <inheritdoc />
    public partial class RemovedWorkerNumberOfCommensDenormalization : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "NumberOfComments",
                table: "Workers");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<uint>(
                name: "NumberOfComments",
                table: "Workers",
                type: "INTEGER",
                nullable: false,
                defaultValue: 0u);
        }
    }
}

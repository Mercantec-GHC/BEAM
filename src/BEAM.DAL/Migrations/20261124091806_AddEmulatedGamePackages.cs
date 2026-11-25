using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BEAM.DAL.Migrations
{
    /// <inheritdoc />
    public partial class AddEmulatedGamePackages : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "BiosFileName",
                table: "Games",
                type: "character varying(120)",
                maxLength: 120,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Categories",
                table: "Games",
                type: "character varying(80)",
                maxLength: 80,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "ControlNotes",
                table: "Games",
                type: "character varying(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CoverFileName",
                table: "Games",
                type: "character varying(120)",
                maxLength: 120,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "EmulatorCore",
                table: "Games",
                type: "character varying(40)",
                maxLength: 40,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PackageId",
                table: "Games",
                type: "character varying(32)",
                maxLength: 32,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "RomFileName",
                table: "Games",
                type: "character varying(120)",
                maxLength: 120,
                nullable: true);

            migrationBuilder.UpdateData(
                table: "Games",
                keyColumn: "Id",
                keyValue: 1,
                columns: new[] { "BiosFileName", "Categories", "ControlNotes", "CoverFileName", "EmulatorCore", "PackageId", "RomFileName" },
                values: new object[] { null, "roms", null, null, null, null, null });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "BiosFileName",
                table: "Games");

            migrationBuilder.DropColumn(
                name: "Categories",
                table: "Games");

            migrationBuilder.DropColumn(
                name: "ControlNotes",
                table: "Games");

            migrationBuilder.DropColumn(
                name: "CoverFileName",
                table: "Games");

            migrationBuilder.DropColumn(
                name: "EmulatorCore",
                table: "Games");

            migrationBuilder.DropColumn(
                name: "PackageId",
                table: "Games");

            migrationBuilder.DropColumn(
                name: "RomFileName",
                table: "Games");
        }
    }
}

using System.ComponentModel.DataAnnotations;

namespace BEAM.DAL;

public sealed class Game
{
    public int Id { get; set; }

    [Required, MaxLength(120)]
    public string Name { get; set; } = "";

    [MaxLength(240)]
    public string? LaunchPath { get; set; }

    [MaxLength(40)] public string? EmulatorCore { get; set; }
    [MaxLength(32)] public string? PackageId { get; set; }
    [MaxLength(120)] public string? RomFileName { get; set; }
    [MaxLength(120)] public string? BiosFileName { get; set; }
    [MaxLength(120)] public string? CoverFileName { get; set; }
    [MaxLength(80)] public string Categories { get; set; } = "roms";
    [MaxLength(1000)] public string? ControlNotes { get; set; }

    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}


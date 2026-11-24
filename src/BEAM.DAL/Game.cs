using System.ComponentModel.DataAnnotations;

namespace BEAM.DAL;

public sealed class Game
{
    public int Id { get; set; }

    [Required, MaxLength(120)]
    public string Name { get; set; } = "";

    [MaxLength(240)]
    public string? LaunchPath { get; set; }

    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}


using Microsoft.EntityFrameworkCore;

namespace BEAM.DAL;

public sealed class BeamDbContext(DbContextOptions<BeamDbContext> options) : DbContext(options)
{
    public DbSet<Game> Games => Set<Game>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        // Reserve lower IDs for bundled catalog entries seeded by migrations.
        modelBuilder.Entity<Game>().Property(game => game.Id).HasIdentityOptions(startValue: 1000);
        modelBuilder.Entity<Game>().HasData(new Game
        {
            Id = 1,
            Name = "BEAM Dodge",
            LaunchPath = "/games/beam-dodge/index.html",
            CreatedAtUtc = new DateTime(2026, 11, 19, 0, 0, 0, DateTimeKind.Utc)
        });
    }
}


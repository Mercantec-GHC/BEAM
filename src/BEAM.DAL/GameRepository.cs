using Microsoft.EntityFrameworkCore;

namespace BEAM.DAL;

public sealed class GameRepository(IDbContextFactory<BeamDbContext> factory)
{
    public async Task<Game?> FindAsync(int id)
    {
        await using var db = await factory.CreateDbContextAsync();
        var game = await db.Games.AsNoTracking().SingleOrDefaultAsync(game => game.Id == id);
        if (game is not null) SetEmulatorLaunchPath(game);
        return game;
    }

    public async Task<int> AddEmulatedAsync(Game game)
    {
        await using var db = await factory.CreateDbContextAsync();
        db.Games.Add(game);
        await db.SaveChangesAsync();
        SetEmulatorLaunchPath(game);
        return game.Id;
    }
    public async Task<List<Game>> ListAsync()
    {
        await using var db = await factory.CreateDbContextAsync();
        var games = await db.Games.AsNoTracking().OrderBy(game => game.Name).ToListAsync();
        foreach (var game in games) SetEmulatorLaunchPath(game);
        return games;
    }

    // The generated identity is only available after insertion. Derive emulator URLs
    // on read so creating a game needs one atomic database write.
    private static void SetEmulatorLaunchPath(Game game)
    {
        if (game.EmulatorCore is not null) game.LaunchPath = $"/emulator/index.html?game={game.Id}";
    }

    public async Task AddAsync(string name)
    {
        name = name.Trim();
        if (name.Length is < 1 or > 120)
            throw new ArgumentException("Enter a game name of up to 120 characters.", nameof(name));

        await using var db = await factory.CreateDbContextAsync();
        db.Games.Add(new Game { Name = name });
        await db.SaveChangesAsync();
    }

    public async Task DeleteAsync(int id)
    {
        await using var db = await factory.CreateDbContextAsync();
        await db.Games.Where(game => game.Id == id).ExecuteDeleteAsync();
    }
}


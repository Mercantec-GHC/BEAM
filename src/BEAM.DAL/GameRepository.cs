using Microsoft.EntityFrameworkCore;

namespace BEAM.DAL;

public sealed class GameRepository(IDbContextFactory<BeamDbContext> factory)
{
    public async Task<List<Game>> ListAsync()
    {
        await using var db = await factory.CreateDbContextAsync();
        return await db.Games.AsNoTracking().OrderBy(game => game.Name).ToListAsync();
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


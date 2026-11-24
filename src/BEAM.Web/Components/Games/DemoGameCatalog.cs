using System.Text.Json;

namespace BEAM.Web.Components.Games;

/// <summary>One catalog of games. Category views share the same game objects and artwork.</summary>
public static class DemoGameCatalog
{
    public static IReadOnlyList<GameCover> Games { get; } = LoadGames();

    public static IReadOnlyList<GameCategory> Categories { get; } =
    [
        GameCategory.FromCatalog("homemade", "Homemade", Games),
        GameCategory.FromCatalog("roms", "ROMS", Games),
        GameCategory.FromCatalog("arcade", "Arcade", Games),
        GameCategory.FromCatalog("fighter", "Fighter", Games)
    ];

    private static GameCover[] LoadGames()
    {
        using var stream = typeof(DemoGameCatalog).Assembly
            .GetManifestResourceStream("BEAM.Web.Data.demo-games.json")
            ?? throw new InvalidOperationException("The demo game catalog is missing.");
        return JsonSerializer.Deserialize<GameCover[]>(stream, new JsonSerializerOptions(JsonSerializerDefaults.Web)) ?? [];
    }
}

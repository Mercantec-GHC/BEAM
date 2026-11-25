using System.Text.Json;

namespace BEAM.Web.Components.Games;

/// <summary>One catalog of games. Category views share the same game objects and artwork.</summary>
public static class DemoGameCatalog
{
    public static IReadOnlyList<GameCover> Games { get; } = LoadGames();

    public static IReadOnlyList<GameCategory> Categories { get; } = BuildCategories([]);

    public static IReadOnlyList<GameCategory> BuildCategories(IEnumerable<GameCover> uploaded)
    {
        var games = Games.Concat(uploaded).Where(game => !string.IsNullOrWhiteSpace(game.LaunchUrl))
            .OrderBy(game => game.Title, StringComparer.OrdinalIgnoreCase).ToArray();
        GameCategory[] categories =
        [
            new("all", "All games", games),
            GameCategory.FromCatalog("homemade", "Homemade", games),
            GameCategory.FromCatalog("roms", "ROMS", games),
            GameCategory.FromCatalog("arcade", "Arcade", games),
            GameCategory.FromCatalog("fighter", "Fighter", games)
        ];
        return categories.Where(category => category.Id == "all" || category.Games.Count > 0).ToArray();
    }

    private static GameCover[] LoadGames()
    {
        using var stream = typeof(DemoGameCatalog).Assembly
            .GetManifestResourceStream("BEAM.Web.Data.demo-games.json")
            ?? throw new InvalidOperationException("The demo game catalog is missing.");
        return JsonSerializer.Deserialize<GameCover[]>(stream, new JsonSerializerOptions(JsonSerializerDefaults.Web)) ?? [];
    }
}

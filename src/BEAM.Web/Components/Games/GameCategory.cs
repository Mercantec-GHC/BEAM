namespace BEAM.Web.Components.Games;

public sealed record GameCategory(string Id, string Name, IReadOnlyList<GameCover> Games)
{
    public static GameCategory FromCatalog(string id, string name, IEnumerable<GameCover> catalog) =>
        new(id, name, catalog.Where(game => game.CategoryIds.Contains(id, StringComparer.OrdinalIgnoreCase)).ToArray());
}

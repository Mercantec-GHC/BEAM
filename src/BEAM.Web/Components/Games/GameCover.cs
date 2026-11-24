namespace BEAM.Web.Components.Games;

public sealed record GameCover(
    string Id,
    string Title,
    string Genre,
    string ImageUrl,
    IReadOnlyList<string> CategoryIds,
    string? LaunchUrl = null);

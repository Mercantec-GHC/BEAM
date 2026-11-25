using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Components.Forms;

namespace BEAM.Web;

// Packages live outside wwwroot and are streamed through a constrained read-only endpoint.
public sealed partial class GameAssetStore(IWebHostEnvironment environment, IConfiguration configuration)
{
    public const long MaxRomBytes = 512L * 1024 * 1024;
    public const long MaxBiosBytes = 32L * 1024 * 1024;
    public const long MaxCoverBytes = 5L * 1024 * 1024;
    private readonly string root = Path.GetFullPath(configuration["GameStorage:Path"]
        ?? Path.Combine(environment.ContentRootPath, "App_Data", "games"));

    [GeneratedRegex(@"^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$")]
    private static partial Regex SafeName();

    public static string FileName(string name)
    {
        if (!SafeName().IsMatch(name) || name.Contains(".."))
            throw new ArgumentException("Use a filename of up to 120 letters, numbers, dots, hyphens or underscores, without folders.");
        return name;
    }

    public string? Resolve(string package, string name)
    {
        if (!Guid.TryParseExact(package, "N", out _) || !SafeName().IsMatch(name) || name.Contains("..")) return null;
        return Path.Combine(root, package, name);
    }

    public async Task SaveAsync(string package, IBrowserFile file, long limit, bool cover = false)
    {
        var name = FileName(file.Name);
        var path = Resolve(package, name) ?? throw new ArgumentException("Invalid game package.");
        if (file.Size == 0 || file.Size > limit) throw new ArgumentException($"{name} must be between 1 byte and {limit / 1024 / 1024} MB.");
        if (cover && !new[] { ".png", ".jpg", ".jpeg", ".webp" }.Contains(Path.GetExtension(name).ToLowerInvariant()))
            throw new ArgumentException("Choose a PNG, JPEG or WebP cover.");
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        await using var input = file.OpenReadStream(limit);
        await using (var output = new FileStream(path, FileMode.CreateNew, FileAccess.Write, FileShare.None, 81920, true))
            await input.CopyToAsync(output);
        if (cover)
        {
            var header = new byte[12];
            await using var image = File.OpenRead(path);
            var length = await image.ReadAsync(header);
            var extension = Path.GetExtension(name).ToLowerInvariant();
            var valid = extension switch
            {
                ".png" => length >= 8 && header.AsSpan(0, 8).SequenceEqual(new byte[] { 137, 80, 78, 71, 13, 10, 26, 10 }),
                ".jpg" or ".jpeg" => length >= 3 && header[0] == 255 && header[1] == 216 && header[2] == 255,
                ".webp" => length >= 12 && header.AsSpan(0, 4).SequenceEqual("RIFF"u8) && header.AsSpan(8, 4).SequenceEqual("WEBP"u8),
                _ => false
            };
            if (!valid) throw new ArgumentException("The cover contents do not match its image format.");
        }
    }

    public void Remove(string? package)
    {
        if (package is null || !Guid.TryParseExact(package, "N", out _)) return;
        var path = Path.GetFullPath(Path.Combine(root, package));
        if (!path.StartsWith(root + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase)) return;
        if (Directory.Exists(path)) Directory.Delete(path, recursive: true);
    }

    public static string Url(string package, string name) => $"/game-assets/{package}/{Uri.EscapeDataString(name)}";
}

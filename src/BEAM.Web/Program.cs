using BEAM.Web.Components;
using BEAM.Web;
using BEAM.DAL;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);
builder.AddServiceDefaults();
builder.Services.AddBeamDataAccess(builder.Configuration.GetConnectionString("beamdb")
    ?? throw new InvalidOperationException("Missing connection string 'beamdb'. Start via Aspire or Docker Compose."));
builder.Services.AddHealthChecks().AddCheck<DatabaseHealthCheck>("postgres");

// Add services to the container.
builder.Services.AddRazorComponents()
    .AddInteractiveServerComponents();
builder.Services.AddSingleton<GameAssetStore>();

var app = builder.Build();

// Convenient for this single-instance local setup. Disable for managed deployments.
if (app.Configuration.GetValue("Database:ApplyMigrations", false))
{
    await using var scope = app.Services.CreateAsyncScope();
    var factory = scope.ServiceProvider.GetRequiredService<IDbContextFactory<BeamDbContext>>();
    await using var db = await factory.CreateDbContextAsync();
    await db.Database.MigrateAsync();
}

// Configure the HTTP request pipeline.
if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Error", createScopeForErrors: true);
    // The default HSTS value is 30 days. You may want to change this for production scenarios, see https://aka.ms/aspnetcore-hsts.
    app.UseHsts();
}
app.UseStatusCodePagesWithReExecute("/not-found", createScopeForStatusCodePages: true);
if (builder.Configuration.GetValue("HttpsRedirection:Enabled", true))
{
    app.UseHttpsRedirection();
}

app.UseAntiforgery();

app.MapStaticAssets();
app.MapMethods("/game-assets/{package}/{name}", ["GET", "HEAD"], (string package, string name, GameAssetStore store, HttpContext context) =>
{
    var path = store.Resolve(package, name);
    if (path is null || !File.Exists(path)) return Results.NotFound();
    context.Response.Headers.XContentTypeOptions = "nosniff";
    var contentType = Path.GetExtension(name).ToLowerInvariant() switch
    {
        ".png" => "image/png", ".jpg" or ".jpeg" => "image/jpeg", ".webp" => "image/webp",
        ".zip" => "application/zip", _ => "application/octet-stream"
    };
    return Results.File(path, contentType, enableRangeProcessing: true);
});
app.MapGet("/emulator/games/{id:int}", async (int id, GameRepository repository) =>
{
    var game = await repository.FindAsync(id);
    if (game?.PackageId is null || game.RomFileName is null || EmulatorSystems.Find(game.EmulatorCore) is null)
        return Results.NotFound();
    return Results.Ok(new
    {
        game.Id, title = game.Name, core = game.EmulatorCore, romFileName = game.RomFileName,
        romUrl = GameAssetStore.Url(game.PackageId, game.RomFileName),
        biosUrl = game.BiosFileName is null ? null : GameAssetStore.Url(game.PackageId, game.BiosFileName),
        controlNotes = game.ControlNotes,
        warning = game.EmulatorCore == "mame2003_plus" && game.RomFileName.Equals("tektagt.zip", StringComparison.OrdinalIgnoreCase)
            ? "Tekken Tag cannot boot with the shipped core: its game driver is missing." : null
    });
});
app.MapDefaultEndpoints();
app.MapRazorComponents<App>()
    .AddInteractiveServerRenderMode();

app.Run();

# BEAM

A browser-game storefront built with .NET 10, Blazor Server, EF Core, PostgreSQL, and Aspire.

## Architecture

Blazor components call `BEAM.DAL` repositories directly in the server process. There is no application API layer. `IDbContextFactory<BeamDbContext>` creates a short-lived EF Core context per operation, avoiding shared contexts across long-lived Blazor circuits.

The online catalog uses PostgreSQL. Downloaded HTML/JavaScript/WebAssembly games execute inside the browser, independently of Blazor Server. A static PWA library and service worker provide offline launching. Game files are static assets, not API endpoints. The included BEAM Dodge game demonstrates online play, explicit offline download/removal, keyboard/touch controls, and a local best score.

## Start with Docker Compose

Install Docker Desktop with Linux containers enabled. On first setup:

```powershell
Copy-Item .env.example .env
```

The database password defaults to `beam`; set `POSTGRES_PASSWORD` in `.env` to override it. Then:

```powershell
docker compose up --build -d
```

Default addresses (override ports in `.env`):

- Storefront: http://localhost:8080
- Game library: http://localhost:8080/play/index.html
- Catalog: http://localhost:8080/games
- Dashboard: http://localhost:18888
- PostgreSQL: localhost:5432, database `beam`, username `beam`
- Readiness including PostgreSQL: `/health`; process liveness: `/alive`

The verified local setup uses web port **18080** and PostgreSQL port **15432** because the defaults were occupied. The generated password stays in the ignored `.env` file.

PostgreSQL 18 runs locally on your physical machine through Docker. Its named volume persists across container rebuilds and `docker compose down`. On Windows, Docker Desktop stores that volume on its local Linux VM disk. It is not a remote/cloud database or a Windows PostgreSQL service. Do not run `docker compose down -v` unless you intend to delete the database.

Compose applies checked-in EF migrations at startup after PostgreSQL becomes healthy. This is a single-instance development convenience; use a controlled migration step for multi-instance deployments. The app runs as a non-root container user.

```powershell
docker compose logs -f
# Stop containers while keeping database data:
docker compose down
```

Compose's dashboard image is 13.6.5 because an Aspire 17 image was unavailable when verified. The AppHost independently uses Aspire 17 packages. Compose exposes the app, database, and anonymous dashboard only on loopback. Add authentication and TLS before making the catalog writable over a network.

## Start with Aspire

Install the .NET 10 SDK and start Docker Desktop:

```powershell
dotnet dev-certs https --trust
dotnet build BEAM.slnx -c Release
dotnet run --project src/BEAM.AppHost
```

Open the dashboard URL printed in the terminal, then its `web` resource. Aspire starts local PostgreSQL, injects `ConnectionStrings:beamdb`, waits for database health, and starts the Blazor app with migrations enabled. Its database persists in `beam-aspire-postgres`. Aspire and Compose use **separate volumes/databases**; they are alternative local workflows. Use one at a time. Aspire manages its database password and mapped port; inspect its dashboard for connection details.

To run the web project independently, configure `ConnectionStrings__beamdb` and, for this local setup, `Database__ApplyMigrations=true` before `dotnet run --project src/BEAM.Web --launch-profile https`.

## Game selector and categories

Open `/GameSlider`. Left/Right browse games, Up cycles Homemade → ROMS → Arcade → Fighter, Down cycles in reverse, and Enter launches a playable selection. Each category remembers its selection. Category changes use a short CSS tilt/slide in the chosen direction; set `--category-duration: 0ms` in `game-slider.css` to disable that motion. Reduced-motion preferences disable it automatically.

The shared demo catalog is in `src/BEAM.Web/Data/demo-games.json`. A game's `categoryIds` can contain multiple tags, such as `["homemade", "fighter"]` or `["roms", "arcade", "racing"]`. `DemoGameCatalog` builds category views by filtering these tags; games retain the same ID, artwork, and launch target in every view. Add another `GameCategory.FromCatalog` entry there to expose a new tag as a selectable category.

The demo has 20 unique games shared across four categories with exactly 10 entries each. Its SVG placeholder covers live in `wwwroot/images/games/placeholders`. Catalog JSON is embedded in the app, so rebuild after editing it. The frontend reuses seven image nodes (five visible covers and two hidden buffers) across all categories.

Run local checks with `node --test tests/carousel.test.cjs tests/catalog.test.cjs`. Set `BEAM_TEST_URL` to the running storefront URL to also verify rendered category membership and cover delivery.

## PWA and offline games

1. Open `/play/index.html` while connected.
2. Choose **Download for offline play** for BEAM Dodge and wait for the downloaded status.
3. Install BEAM using the browser's install action. On iPhone/iPad use Safari → Share → Add to Home Screen.
4. Disable the network or stop the server. Reopen the installed app/library and select **Play**.
5. Remove a download using **Remove download**.

PWA installation and service workers require HTTPS, with an exception for localhost. A phone accessing the host over a LAN IP needs a trusted HTTPS address and network configuration; the default loopback-only Compose setup intentionally isn't reachable from phones. An installed PWA is a browser-managed app, not an APK or App Store package. Installation prompts depend on the browser/platform.

Only the static library, offline page, and explicitly downloaded game assets are cached. Server-rendered catalog pages and Blazor circuits are never cached. The catalog and its database operations require the server; downloaded games keep running without it. No multiplayer backend, cloud saves, account system, store payments, or automatic save synchronization is included. 'Play online' currently means playing while connected, not multiplayer.

Downloads and saves belong to the browser profile and device. Site-data removal or browser storage eviction can delete them. The launcher requests persistent storage after a download, but the browser decides whether to grant it. No PostgreSQL credentials or connections are sent to the browser.

To add an offline-capable game, place its complete self-contained package under `wwwroot/games/<id>/`, add catalog metadata through an EF migration, and register its library entry and every required asset with the service worker. The starter currently registers one package. Use same-origin relative assets, include dependencies (no CDN-only libraries), version game caches when assets change, and keep runtime network calls optional for offline play. The sample worker caches the library separately from game packages and uses atomic downloads.

## EF Core migrations

Migrations and the design-time context factory live in `BEAM.DAL`. The local EF tool is pinned in `dotnet-tools.json`:

```powershell
dotnet tool restore
dotnet ef migrations add DescribeChange --project src/BEAM.DAL
# For manual updates, set ConnectionStrings__beamdb to your local database first:
dotnet ef database update --project src/BEAM.DAL
```

Migration generation does not require a running database. Schema changes should use migrations, not `EnsureCreated`.

## Layout and validation

```text
src/BEAM.Web              Blazor storefront, direct DAL calls, PWA and game assets
src/BEAM.DAL              Entities, context factory, repositories, EF migrations
src/BEAM.AppHost          Aspire and persistent local PostgreSQL orchestration
src/BEAM.ServiceDefaults  Telemetry, resilience, health checks
Dockerfile               Multi-stage .NET 10 web image
compose.yaml             Web + PostgreSQL + telemetry dashboard
```

```powershell
dotnet build BEAM.slnx -c Release
docker compose config --quiet
# Optional browser integration check (requires Node/npm):
npm install --no-save --package-lock=false playwright
npx playwright install chromium
node tests/browser-smoke.cjs
```

The browser smoke check covers catalog writes/deletes, offline download, offline game execution, offline storefront fallback, and download removal. Set `BEAM_TEST_URL` if the app isn't at http://localhost:18080. It creates and removes its own uniquely named catalog row.
Arcade Machines and stuff



## our documentation

https://docs.google.com/document/d/11LQO4RGVMj__4UehWCmgdmXCMFZWWjUe9_7eakC0ipU/edit?pli=1&tab=t.0

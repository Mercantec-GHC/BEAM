# BEAM

Arcade cabinet: configure the physical return button as a USB keyboard input sending **F8**. During a game, F8 unloads the game and restores the carousel selection, including when the nested emulator has focus. The on-screen return button and emulator toolbar are hidden.

A browser-game storefront built with .NET 10, Blazor Server, EF Core, PostgreSQL, and Aspire.

## Architecture

Blazor components call `BEAM.DAL` repositories directly in the server process. The static emulator player uses a read-only game configuration endpoint and streams uploaded assets from the server. `IDbContextFactory<BeamDbContext>` creates a short-lived EF Core context per operation, avoiding shared contexts across long-lived Blazor circuits.

The online catalog uses PostgreSQL. Downloaded HTML/JavaScript/WebAssembly games execute inside the browser, independently of Blazor Server. A static PWA library and service worker provide offline launching. Game files are static assets, not API endpoints. The included BEAM Dodge game demonstrates online play, explicit offline download/removal, keyboard/touch controls, and a local best score.

## Start with Docker Compose

Install Docker Desktop with Linux containers enabled. On first setup:

```powershell
Copy-Item .env.example .env
```

Set a local `POSTGRES_PASSWORD` in `.env`, then:

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

Open `/GameSlider`. It starts on **All games**, including saved uploads and the bundled BEAM Dodge game. Left/Right browse games, Up/Down cycle through nonempty categories (All games, Homemade, ROMS, Arcade, Fighter), and Enter launches the selection. Each category remembers its selection. Category changes use a short CSS tilt/slide in the chosen direction; set `--category-duration: 0ms` in `game-slider.css` to disable that motion. Reduced-motion preferences disable it automatically.

The bundled catalog in `src/BEAM.Web/Data/demo-games.json` contains BEAM Dodge. Saved uploads are read from PostgreSQL each time the selector opens and merged into the same category views. Every upload appears in All games and ROMS, plus its selected Arcade/Fighter categories. The library's **View saved game in selector** and **Show in selector** links open `/GameSlider?game=uploaded-<id>` with that game selected. Deleting a game removes it from the selector on its next visit.

Fictional demo entries and their cover assets have been removed. Uploaded covers are used when available; otherwise a neutral BEAM controller cover is shown. The frontend reuses seven image nodes (five visible covers and two hidden buffers) across all categories. Only changes to the bundled catalog require a rebuild; uploaded games do not.

Run local checks with `node --test tests/carousel.test.cjs tests/catalog.test.cjs`. Set `BEAM_TEST_URL` to the running storefront URL to also verify rendered category membership and cover delivery.

## EmulatorJS and Tekken Tag Tournament

### Add games without changing code

Open **Emulated games** in the navigation (`/emulated-games`). Enter a title, choose a system, upload the ROM, and optionally add a BIOS, cover and control notes. Select Arcade and/or Fighter to add those categories; every uploaded game appears in ROMS. Save the game, then launch it from the library, `/games`, or `/GameSlider`. Deleting an uploaded game removes its database entry and package files.

The initial supported choices are NES, SNES, Game Boy/Color, Game Boy Advance, Mega Drive/Genesis, PlayStation, FinalBurn Neo and MAME 2003 Plus. File extensions and core compatibility hints appear in the form. Arcade ZIPs must be complete sets matching the chosen core. For PlayStation, use CHD/PBP or ZIP with CUE and BIN tracks. BIOS ZIPs can hold multiple required BIOS files. Controls can be mapped in EmulatorJS's menu; player notes are saved with the game, while mappings and emulator saves belong to the browser profile.

Limits: ROM 512 MB, BIOS 32 MB, cover 5 MB (PNG/JPEG/WebP). Filenames may contain letters, numbers, dots, hyphens and underscores, up to 120 characters, without paths. Arcade ROM filenames are preserved because they identify the driver. The server checks formats/extensions and sizes, but only a real boot test can establish game compatibility.

Metadata is stored in PostgreSQL through the `AddEmulatedGamePackages` migration. Uploaded files live outside `wwwroot`, in `src/BEAM.Web/App_Data/games` by default, or the absolute directory configured by `GameStorage__Path`. Docker Compose mounts the persistent `game-data` volume at `/app/game-data`; this survives rebuilds and normal `docker compose down`. Back up both PostgreSQL and game storage. Uploads are excluded from Git and Docker build context. This uses the same local, unauthenticated catalog management model as `/games`; uploaded assets are served to visitors who launch a game.

Run `node tests/game-library-smoke.cjs` against a running migrated BEAM instance with `BEAM_TEST_URL` set to its URL. The test creates and removes its own game and checks upload validation, persistence, category membership, player configuration, range requests, restart and deletion. With `BEAM_REAL_EMULATOR=1`, it also boots an original generated NES cartridge through the actual CDN/core and checks its expected red backdrop. Install Playwright for the browser tests and `sharp` for that optional screenshot check. `BEAM_CHROMIUM_PATH` may point to an existing Chromium executable.

For an arcade boot/input check, set `BEAM_ARCADE_ROM` to a complete ROM ZIP and run `node tests/arcade-boot.cjs`. Optional variables: `BEAM_ARCADE_CORE` (default `mame2003_plus`), `BEAM_ARCADE_TITLE`, and `BEAM_KEEP_GAME=1` to retain the uploaded entry. Alternatively, set `BEAM_ARCADE_GAME_URL` to an existing relative player URL to test without uploading again. Screenshots and core diagnostics go to `test-results/arcade`; review the screenshots to confirm gameplay beyond a successful core launch. Split arcade ZIPs may omit shared ROMs: supply a complete package including required parent-set files.

### Standalone Tekken compatibility preview

Select Tekken Tag in the game slider or open `/emulator/index.html`. Choose a local `tektagt.zip` (read by the browser, never uploaded), or place an authorized copy at `src/BEAM.Web/wwwroot/roms/tektagt.zip` before building/publishing. ROM ZIPs in that directory are ignored by Git. Installed ROMs are publicly served by the web app, so only deploy files you may distribute.

The static launcher isolates EmulatorJS in an iframe, pins its CDN runtime to **4.2.3**, and selects **mame2003_plus** explicitly. Configure both players, coin, start, attack and tag controls through the emulator menu. Return to BEAM or restart using the buttons outside the iframe. The emulator is independent of the Blazor circuit.

This first integration requires connectivity to the EmulatorJS CDN. It is not included in the Dodge offline download. The ROM must match the shipped core's driver/ROM definitions; current upstream MAME 2003 Plus compatibility does not guarantee that the older pinned WebAssembly build supports a particular game. Browser boot tests and target-machine playability tests are separate checks.

**Tekken test result (2026-11-24):** the 4.2.3 MAME 2003 Plus WebAssembly core (Git `3a72dae`, RetroArch build June 14, 2025) rejects the linked `tektagt.zip` with `Game driver not found for tektagt!` and `Failed to load content`. The resulting RetroArch menu is not a successful Tekken boot. Tekken is therefore marked as a compatibility preview in the launcher. Making it playable requires a newer/custom EmulatorJS-compatible core containing the Namco System 12 driver, followed by another ROM audit and actual gameplay/performance verification. Merely renaming or replacing the ZIP will not add a missing driver.

Run `node tests/emulator-smoke.cjs` with Playwright installed for launcher/error-path tests. Set `BEAM_TEKKEN_ROM` to an absolute path to `tektagt.zip` to additionally exercise the real CDN/core and save a screenshot and core log under `test-results/`. Set `BEAM_CHROMIUM_PATH` only when using an existing Chromium executable instead of Playwright's default browser. The test runs its own static server and does not require PostgreSQL.

For core comparisons, `BEAM_EJS_TEST_DATA=https://cdn.emulatorjs.org/nightly/data/` redirects runtime requests only in the test browser; production stays pinned. Set `BEAM_TEKKEN_INSTALLED=1` to test the same archive through the installed-ROM URL instead of a local blob. The nightly core tested on the same date (Git `10d7085`, RetroArch build July 25, 2026) also reports a missing `tektagt` driver using the installed-ROM URL.

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

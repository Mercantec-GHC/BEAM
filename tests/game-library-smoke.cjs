// Runs against BEAM with PostgreSQL and migrations applied; creates/deletes its own game.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const base = process.env.BEAM_TEST_URL || 'http://localhost:18080';

// Original, generated NROM test cartridge: sets the NES backdrop to red.
// No commercial game data is needed to verify the real emulator path.
function testRom() {
    const header = Buffer.from([0x4e, 0x45, 0x53, 0x1a, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    const prg = Buffer.alloc(16384, 0xea);
    const code = Buffer.from([
        0x78, 0xd8, 0xa2, 0xff, 0x9a, 0xe8, 0x8e, 0x00, 0x20, 0x8e, 0x01, 0x20,
        0x2c, 0x02, 0x20, 0x10, 0xfb,
        0xa9, 0x3f, 0x8d, 0x06, 0x20, 0xa9, 0x00, 0x8d, 0x06, 0x20,
        0xa9, 0x16, 0x8d, 0x07, 0x20, 0xa9, 0x00,
        0x8d, 0x06, 0x20, 0x8d, 0x06, 0x20, 0x8d, 0x05, 0x20, 0x8d, 0x05, 0x20,
        0xa9, 0x08, 0x8d, 0x01, 0x20
    ]);
    code.copy(prg);
    prg[code.length] = 0x4c; prg[code.length + 1] = code.length; prg[code.length + 2] = 0x80;
    for (const offset of [16378, 16380, 16382]) { prg[offset] = 0; prg[offset + 1] = 0x80; }
    return Buffer.concat([header, prg, Buffer.alloc(8192)]);
}

(async () => {
    const browser = await chromium.launch({ headless: true, executablePath: process.env.BEAM_CHROMIUM_PATH });
    const page = await browser.newPage();
    const title = `BEAM emulator smoke ${Date.now()}`;
    let metadata;
    try {
        await page.goto(`${base}/emulated-games`);
        await page.waitForFunction(() => !document.querySelector('fieldset').disabled);
        await page.getByLabel('Title', { exact: true }).fill(title);
        await page.getByRole('button', { name: 'Save game', exact: true }).click();
        await page.getByRole('alert').filter({ hasText: 'Choose a ROM file' }).waitFor();
        await page.getByLabel('ROM file (required)', { exact: true }).setInputFiles({ name: 'wrong.exe', mimeType: 'application/octet-stream', buffer: Buffer.from('not a ROM') });
        await page.getByRole('button', { name: 'Save game', exact: true }).click();
        await page.getByRole('alert').filter({ hasText: 'This system accepts' }).waitFor();
        const rom = testRom();
        await page.getByLabel('ROM file (required)', { exact: true }).setInputFiles({ name: 'beam-smoke.nes', mimeType: 'application/octet-stream', buffer: rom });
        await page.getByLabel('Cover image (optional)', { exact: true }).setInputFiles({ name: 'cover.png', mimeType: 'image/png', buffer: Buffer.from('invalid image') });
        await page.getByRole('button', { name: 'Save game', exact: true }).click();
        await page.getByRole('alert').filter({ hasText: 'cover contents do not match' }).waitFor();
        await page.getByLabel('Cover image (optional)', { exact: true }).setInputFiles({
            name: 'cover.png', mimeType: 'image/png',
            buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII=', 'base64')
        });
        await page.getByLabel('BIOS file (optional)', { exact: true }).setInputFiles({ name: 'optional-bios.bin', mimeType: 'application/octet-stream', buffer: Buffer.from([1, 2, 3]) });
        await page.getByLabel('Arcade', { exact: true }).check();
        await page.getByLabel('Fighter', { exact: true }).check();
        await page.getByLabel('Controls / player notes (optional)', { exact: true }).fill('Use arrows and Enter. <b>Plain text notes</b>');
        await page.getByRole('button', { name: 'Save game', exact: true }).click();
        await page.getByRole('status').filter({ hasText: 'Game saved.' }).waitFor({ timeout: 30000 });
        const link = page.getByRole('link', { name: `Play ${title}`, exact: true });
        const playerPath = await link.getAttribute('href');
        const gameId = new URL(playerPath, base).searchParams.get('game');
        assert.equal(await page.getByRole('link', { name: 'View saved game in selector', exact: true }).getAttribute('href'), `/GameSlider?game=uploaded-${gameId}`);
        metadata = await (await fetch(`${base}/emulator/games/${gameId}`)).json();
        assert.equal(metadata.core, 'fceumm');
        assert.equal(metadata.title, title);
        assert.ok(metadata.biosUrl.endsWith('/optional-bios.bin'));
        const romResponse = await fetch(base + metadata.romUrl);
        assert.equal(romResponse.status, 200);
        assert.deepEqual(Buffer.from(await romResponse.arrayBuffer()), rom);
        const range = await fetch(base + metadata.romUrl, { headers: { Range: 'bytes=0-15' } });
        assert.equal(range.status, 206);
        assert.equal((await range.arrayBuffer()).byteLength, 16);
        const coverPath = metadata.romUrl.replace('beam-smoke.nes', 'cover.png');
        assert.equal((await fetch(base + coverPath)).headers.get('content-type'), 'image/png');
        await page.reload();
        await page.getByRole('link', { name: `Play ${title}`, exact: true }).waitFor();
        const slider = await (await fetch(`${base}/GameSlider`)).text();
        assert.equal([...slider.matchAll(new RegExp(`data-id="uploaded-${gameId}"`, 'g'))].length, 4);
        await page.locator(`article[data-game-id="${gameId}"]`).getByRole('link', { name: 'Show in selector', exact: true }).click();
        await page.waitForFunction(id => document.querySelector('.game-cover[data-slot="0"]')?.dataset.id === `uploaded-${id}`, gameId);
        assert.match(await page.locator('.selection-status').textContent(), new RegExp(title));
        await page.locator('.flow-stage').focus();
        await page.keyboard.press('Enter');
        await page.waitForURL(base + playerPath);
        console.log('PASS: upload validation, rollback on invalid cover, persisted metadata/assets, range requests and selector categories');

        await page.route('https://cdn.emulatorjs.org/**', route => route.fulfill({ contentType: 'text/javascript', body: 'window.EJS_ready();' }));
        await page.goto(base + playerPath);
        await page.getByRole('button', { name: `Start ${title}`, exact: true }).click();
        await page.getByRole('status').filter({ hasText: 'Emulator ready' }).waitFor();
        let runtime = page.frames().find(frame => frame.url().includes('runtime.html'));
        const config = await runtime.evaluate(() => ({ core: EJS_core, id: EJS_gameID, rom: EJS_gameUrl, bios: EJS_biosUrl }));
        assert.deepEqual(config, { core: 'fceumm', id: Number(gameId), rom: metadata.romUrl, bios: metadata.biosUrl });
        assert.equal(await page.locator('#control-notes b').count(), 0);
        await page.getByRole('button', { name: 'Restart game', exact: true }).click();
        assert.ok(await page.locator('#start').isVisible());
        console.log('PASS: shared player uses saved core/ROM/BIOS/game ID, renders notes safely and restarts');

        if (process.env.BEAM_REAL_EMULATOR === '1') {
            await page.unroute('https://cdn.emulatorjs.org/**');
            await page.getByRole('button', { name: `Start ${title}`, exact: true }).click();
            await page.getByRole('status').filter({ hasText: 'Emulator ready' }).waitFor({ timeout: 120000 });
            runtime = page.frames().find(frame => frame.url().includes('runtime.html'));
            await runtime.getByText('Start Game', { exact: true }).click();
            await page.waitForFunction(() => document.querySelector('#player').contentWindow.EJS_emulator?.started, null, { timeout: 120000 });
            await runtime.locator('canvas').waitFor();
            // A running test cartridge should produce red pixels, rather than a RetroArch menu.
            await page.waitForTimeout(3000);
            const sharp = require('sharp');
            const shot = await runtime.locator('canvas').screenshot();
            const dimensions = await sharp(shot).metadata();
            const pixels = await sharp(shot).extract({
                left: Math.floor(dimensions.width / 4), top: Math.floor(dimensions.height / 4),
                width: Math.floor(dimensions.width / 2), height: Math.floor(dimensions.height / 2)
            }).resize(16, 16).ensureAlpha().raw().toBuffer();
            const redPixels = pixels.filter((value, index) => index % 4 === 0 && value > 100 && value > pixels[index + 1] * 1.5 && value > pixels[index + 2] * 1.5).length;
            fs.mkdirSync(path.join(__dirname, '../test-results'), { recursive: true });
            await page.screenshot({ path: path.join(__dirname, '../test-results/library-nes-running.png') });
            assert.ok(redPixels > 200, `Expected red backdrop from generated NES cartridge, got ${redPixels}/256 pixels`);
            console.log('PASS: real EmulatorJS NES core runs uploaded original test cartridge and renders its expected red backdrop');
        }

        await page.goto(`${base}/emulated-games`);
        await page.waitForFunction(() => !document.querySelector('fieldset').disabled);
        await page.getByRole('button', { name: `Delete ${title}`, exact: true }).click();
        await page.getByRole('status').filter({ hasText: 'Game and uploaded files removed' }).waitFor();
        assert.equal((await fetch(base + metadata.romUrl)).status, 404);
        assert.equal((await fetch(base + metadata.biosUrl)).status, 404);
        assert.equal((await fetch(base + coverPath)).status, 404);
        assert.equal((await fetch(`${base}/emulator/games/${gameId}`)).status, 404);
        assert.ok(!(await (await fetch(`${base}/GameSlider`)).text()).includes(`data-id="uploaded-${gameId}"`));
        await page.goto(base + playerPath);
        await page.getByRole('status').filter({ hasText: 'Game unavailable' }).waitFor();
        console.log('PASS: deletion removes the catalog entry and all files; old player links fail clearly');
        metadata = null;

        // A second system must use its selected core rather than the first game's default.
        await page.goto(`${base}/emulated-games`);
        await page.waitForFunction(() => !document.querySelector('fieldset').disabled);
        await page.getByLabel('Title', { exact: true }).fill(title);
        await page.getByLabel('System / emulator', { exact: true }).selectOption('snes9x');
        await page.getByLabel('ROM file (required)', { exact: true }).setInputFiles({ name: 'second-game.sfc', mimeType: 'application/octet-stream', buffer: Buffer.alloc(32768) });
        await page.getByRole('button', { name: 'Save game', exact: true }).click();
        await page.getByRole('status').filter({ hasText: 'Game saved.' }).waitFor();
        const secondPath = await page.getByRole('link', { name: `Play ${title}`, exact: true }).getAttribute('href');
        const secondId = new URL(secondPath, base).searchParams.get('game');
        metadata = await (await fetch(`${base}/emulator/games/${secondId}`)).json();
        assert.equal(metadata.core, 'snes9x');
        assert.equal(metadata.biosUrl, null);
        assert.notEqual(secondId, gameId);
        await page.route('https://cdn.emulatorjs.org/**', route => route.fulfill({ contentType: 'text/javascript', body: 'window.EJS_ready();' }));
        await page.goto(base + secondPath);
        await page.locator('#start').click();
        await page.getByRole('status').filter({ hasText: 'Emulator ready' }).waitFor();
        runtime = page.frames().find(frame => frame.url().includes('runtime.html'));
        assert.equal(await runtime.evaluate(() => EJS_core), 'snes9x');
        assert.equal(await runtime.evaluate(() => typeof EJS_biosUrl), 'undefined');
        console.log('PASS: another game selects a different core, retains its identity and supports omitted BIOS/cover');
    } finally {
        if (metadata) {
            await page.goto(`${base}/emulated-games`);
            await page.waitForFunction(() => !document.querySelector('fieldset').disabled);
            const button = page.getByRole('button', { name: `Delete ${title}`, exact: true });
            if (await button.count()) { await button.click(); await page.getByRole('status').filter({ hasText: 'removed' }).waitFor(); }
        }
        await browser.close();
    }
})().catch(error => { console.error(error); process.exitCode = 1; });

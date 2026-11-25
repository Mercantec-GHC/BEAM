// Run with Node and Playwright installed. No database required.
// Set BEAM_TEKKEN_ROM to a tektagt.zip path for the real core boot check.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const root = path.resolve(__dirname, '../src/BEAM.Web/wwwroot');
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
    const file = path.resolve(root, '.' + new URL(req.url, 'http://localhost').pathname);
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
        res.writeHead(404); res.end(); return;
    }
    res.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream');
    fs.createReadStream(file).pipe(res);
});
(async () => {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    const browser = await chromium.launch({ headless: true, executablePath: process.env.BEAM_CHROMIUM_PATH });
    try {
        const page = await browser.newPage();
        await page.route('**/roms/tektagt.zip', route => route.fulfill({ status: 404 }));
        await page.goto(`${base}/emulator/index.html`);
        await page.locator('#start').click();
        await page.getByRole('status').filter({ hasText: 'No installed ROM found' }).waitFor();
        await page.locator('#rom').setInputFiles({ name: 'tektagt.zip', mimeType: 'application/zip', buffer: Buffer.from('invalid') });
        await page.locator('#start').click();
        await page.getByRole('status').filter({ hasText: 'not a ZIP' }).waitFor();
        const zip = { name: 'tektagt.zip', mimeType: 'application/zip', buffer: Buffer.from([80, 75, 3, 4, 0]) };
        await page.locator('#rom').setInputFiles(zip);
        await page.route('https://cdn.emulatorjs.org/**', route => route.fulfill({
            contentType: 'text/javascript', body: 'window.EJS_ready();'
        }));
        await page.locator('#start').click();
        await page.getByRole('status').filter({ hasText: 'Emulator ready' }).waitFor();
        const frame = page.frames().find(frame => frame.url().includes('runtime.html'));
        assert.equal(await frame.evaluate(() => EJS_core), 'mame2003_plus');
        assert.equal(await frame.evaluate(() => EJS_startOnLoaded), true);
        assert.equal(await frame.evaluate(() => EJS_gameName), 'tektagt.zip');
        assert.ok(await frame.evaluate(() => EJS_gameUrl.startsWith('blob:')));
        await page.locator('#retry').click();
        assert.ok(await page.locator('#setup').isVisible());
        assert.ok(await page.locator('#player').isHidden());
        await page.unroute('https://cdn.emulatorjs.org/**');
        await page.route('https://cdn.emulatorjs.org/**', route => route.abort());
        await page.locator('#start').click();
        await page.getByRole('status').filter({ hasText: 'Emulator failed' }).waitFor();
        console.log('PASS: missing ROM, invalid ZIP, local ROM, isolated core configuration, restart and CDN failure');
        await page.close();

        if (!process.env.BEAM_TEKKEN_ROM) {
            console.log('SKIP: actual Tekken boot; set BEAM_TEKKEN_ROM to your tektagt.zip');
            return;
        }
        const game = await browser.newPage();
        if (process.env.BEAM_EJS_TEST_DATA) {
            await game.route('https://cdn.emulatorjs.org/4.2.3/data/**', async route => {
                const url = route.request().url().replace('https://cdn.emulatorjs.org/4.2.3/data/', process.env.BEAM_EJS_TEST_DATA);
                const response = await route.fetch({ url });
                await route.fulfill({ response });
            });
        }
        const logs = [];
        game.on('console', message => { logs.push(message.text()); console.log('CORE:', message.text()); });
        game.on('pageerror', error => { logs.push(error.message); console.log('ERROR:', error.message); });
        await game.goto(`${base}/emulator/index.html`);
        if (process.env.BEAM_TEKKEN_INSTALLED) {
            await game.route('**/roms/tektagt.zip', route => route.fulfill({ path: process.env.BEAM_TEKKEN_ROM, contentType: 'application/zip' }));
        } else {
            await game.locator('#rom').setInputFiles(process.env.BEAM_TEKKEN_ROM);
        }
        await game.locator('#start').click();
        await game.getByRole('status').filter({ hasText: 'Emulator ready' }).waitFor({ timeout: 120000 });
        const runtime = game.frameLocator('#player');
        await game.frames().find(frame => frame.url().includes('runtime.html')).evaluate(() => { EJS_emulator.debug = true; });
        await runtime.getByText('Start Game', { exact: true }).click();
        // A populated canvas alone does not prove a game boots. Check the core's start event
        // and report diagnostics; visual gameplay still needs confirmation on target hardware.
        await game.waitForFunction(() => {
            const frame = document.querySelector('#player');
            return frame.contentWindow.EJS_emulator?.started;
        }, null, { timeout: 120000 });
        await runtime.locator('canvas').waitFor({ timeout: 120000 });
        await game.waitForTimeout(15000);
        fs.mkdirSync(path.join(__dirname, '../test-results'), { recursive: true });
        await game.screenshot({ path: path.join(__dirname, '../test-results/tekken-boot.png') });
        fs.writeFileSync(path.join(__dirname, '../test-results/tekken-core.log'), logs.join('\n'));
        assert.ok(!logs.some(line => /(?:game )?driver.*not found|romset.*not found|missing required|fatal error|failed to load content/i.test(line)), 'Core reported a ROM/driver error');
        console.log('PASS: core started and canvas created; inspect test-results/tekken-boot.png for actual gameplay');
    } finally {
        await browser.close();
        await new Promise(resolve => server.close(resolve));
    }
})().catch(error => { console.error(error); process.exitCode = 1; server.close(); });

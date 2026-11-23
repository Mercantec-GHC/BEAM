const { chromium } = require('playwright');
const assert = require('node:assert/strict');

(async () => {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();
    const base = process.env.BEAM_TEST_URL || 'http://localhost:18080';
    const name = `BEAM smoke ${Date.now()}`;
    try {
        await page.goto(`${base}/games`);
        await page.getByLabel('Game name', { exact: true }).fill(name);
        await page.getByRole('button', { name: 'Add game', exact: true }).click();
        await page.getByText(name, { exact: true }).waitFor();
        await page.reload();
        await page.getByText(name, { exact: true }).waitFor();
        await page.getByRole('button', { name: `Delete ${name}`, exact: true }).click();
        await page.getByText(name, { exact: true }).waitFor({ state: 'detached' });
        console.log('PASS: direct Blazor/DAL catalog create, persisted reload, delete');

        await page.goto(`${base}/play/index.html`);
        await page.getByRole('button', { name: 'Download for offline play', exact: true }).click();
        await page.getByText('Downloaded — ready for offline play', { exact: true }).waitFor();
        await context.setOffline(true);
        await page.reload();
        await page.getByText('Downloaded — ready for offline play', { exact: true }).waitFor();
        await page.getByRole('link', { name: 'Play', exact: true }).click();
        await page.getByRole('button', { name: 'Start game', exact: true }).click();
        await page.waitForFunction(() => document.querySelector('#score').textContent.startsWith('Time:'));
        assert.ok(await page.evaluate(() => !!document.querySelector('canvas').getContext('2d')));
        console.log('PASS: library reload and game execution with network disabled');

        await page.goto(`${base}/games`);
        await page.getByRole('heading', { name: "You're offline" }).waitFor();
        await page.getByRole('link', { name: 'Open offline library' }).click();
        await page.getByRole('button', { name: 'Remove download' }).click();
        await page.getByText('Not downloaded', { exact: true }).waitFor();
        console.log('PASS: offline storefront fallback and removal');
        await context.setOffline(false);
        const health = await page.request.get(`${base}/health`);
        assert.equal(health.status(), 200);
        const manifest = await (await page.request.get(`${base}/manifest.webmanifest`)).json();
        assert.equal(manifest.display, 'standalone');
        for (const icon of manifest.icons) assert.equal((await page.request.get(base + icon.src)).status(), 200);
        console.log('PASS: database readiness, PWA manifest, install icons');
    } finally {
        await browser.close();
    }
})().catch(error => { console.error(error); process.exitCode = 1; });

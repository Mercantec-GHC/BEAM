// Upload and exercise an arcade ROM through BEAM's real shared player.
// BEAM_ARCADE_ROM: absolute ZIP path; optional BEAM_ARCADE_CORE, BEAM_ARCADE_TITLE.
// Set BEAM_KEEP_GAME=1 to retain the uploaded library entry after the test.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const base = process.env.BEAM_TEST_URL || 'http://localhost:18080';
const core = process.env.BEAM_ARCADE_CORE || 'mame2003_plus';
const title = process.env.BEAM_ARCADE_TITLE || `Arcade boot test ${Date.now()}`;
const output = path.join(__dirname, '../test-results/arcade');

(async () => {
    assert.ok(process.env.BEAM_ARCADE_ROM || process.env.BEAM_ARCADE_GAME_URL, 'Set BEAM_ARCADE_ROM or BEAM_ARCADE_GAME_URL');
    fs.mkdirSync(output, { recursive: true });
    const browser = await chromium.launch({ headless: true, executablePath: process.env.BEAM_CHROMIUM_PATH });
    const page = await browser.newPage();
    const logs = [];
    let uploaded = false;
    page.on('console', message => logs.push(message.text()));
    page.on('pageerror', error => logs.push(`PAGE ERROR: ${error.message}`));
    try {
        let playerPath = process.env.BEAM_ARCADE_GAME_URL;
        if (!playerPath) {
        await page.goto(`${base}/emulated-games`);
        await page.waitForFunction(() => !document.querySelector('fieldset').disabled);
        await page.getByLabel('Title', { exact: true }).fill(title);
        await page.getByLabel('System / emulator', { exact: true }).selectOption(core);
        await page.getByLabel('ROM file (required)', { exact: true }).setInputFiles(process.env.BEAM_ARCADE_ROM);
        await page.getByLabel('Arcade', { exact: true }).check();
        if (process.env.BEAM_ARCADE_FIGHTER === '1') await page.getByLabel('Fighter', { exact: true }).check();
        await page.getByLabel('Controls / player notes (optional)', { exact: true }).fill('Keyboard: V inserts a coin, Enter starts Player 1, arrow keys move. Configure gamepads in the emulator controls menu.');
        await page.getByRole('button', { name: 'Save game', exact: true }).click();
        await page.getByRole('status').filter({ hasText: 'Game saved.' }).waitFor({ timeout: 30000 });
        uploaded = true;
        playerPath = await page.getByRole('link', { name: `Play ${title}`, exact: true }).getAttribute('href');
        }
        fs.writeFileSync(path.join(output, 'game.json'), JSON.stringify({ title, core, playerUrl: base + playerPath }, null, 2));
        await page.goto(base + playerPath);
        await page.locator('#start').click();
        await page.getByRole('status').filter({ hasText: 'Emulator ready' }).waitFor({ timeout: 120000 });
        const runtime = page.frames().find(frame => frame.url().includes('runtime.html'));
        await runtime.evaluate(() => { EJS_emulator.debug = true; });
        await runtime.getByText('Start Game', { exact: true }).click();
        await page.waitForFunction(() => document.querySelector('#player').contentWindow.EJS_emulator?.started, null, { timeout: 120000 });
        await runtime.locator('canvas').waitFor();
        await page.waitForTimeout(Number(process.env.BEAM_ARCADE_BOOT_WAIT_MS || 8000));
        await page.screenshot({ path: path.join(output, '01-boot.png') });
        const failures = logs.filter(line => /driver.*not found|missing required|fatal error|failed to load content|required files are missing|romset.*not found/i.test(line));
        assert.equal(failures.length, 0, failures.join('\n'));
        await runtime.locator('canvas').click();
        await page.keyboard.press('Enter', { delay: 150 }); // Dismiss any initial core notice.
        await page.waitForTimeout(500);
        await page.keyboard.press('v', { delay: 150 });
        await page.waitForTimeout(1000);
        await page.keyboard.press('Enter', { delay: 150 });
        await page.waitForTimeout(5000);
        if (process.env.BEAM_ARCADE_CONFIRM_KEY) {
            await page.keyboard.press(process.env.BEAM_ARCADE_CONFIRM_KEY, { delay: 150 });
            await page.waitForTimeout(6000);
        }
        await page.screenshot({ path: path.join(output, '02-started.png') });
        await page.keyboard.down('ArrowLeft');
        await page.waitForTimeout(1800);
        await page.keyboard.up('ArrowLeft');
        await page.keyboard.down('ArrowUp');
        await page.waitForTimeout(1800);
        await page.keyboard.up('ArrowUp');
        await page.screenshot({ path: path.join(output, '03-playing.png') });
        console.log(`CORE BOOT CHECK PASSED: ${title}, ${core}`);
        console.log(`Review screenshots for gameplay: ${output}`);
        console.log(`Player: ${base + playerPath}`);
    } finally {
        fs.writeFileSync(path.join(output, 'core.log'), logs.join('\n'));
        if (uploaded && process.env.BEAM_KEEP_GAME !== '1') {
            await page.goto(`${base}/emulated-games`);
            await page.waitForFunction(() => !document.querySelector('fieldset').disabled);
            await page.getByRole('button', { name: `Delete ${title}`, exact: true }).click();
            await page.getByRole('status').filter({ hasText: 'removed' }).waitFor();
        }
        await browser.close();
    }
})().catch(error => { console.error(error); process.exitCode = 1; });

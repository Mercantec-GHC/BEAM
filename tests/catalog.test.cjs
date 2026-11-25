const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const webRoot = path.join(__dirname, '../src/BEAM.Web');
const catalog = JSON.parse(fs.readFileSync(path.join(webRoot, 'Data/demo-games.json'), 'utf8'));
const categoryNames = { all: 'All games', homemade: 'Homemade', roms: 'ROMS', arcade: 'Arcade', fighter: 'Fighter' };

test('bundled catalog contains only the installed playable game', () => {
    assert.deepEqual(catalog.map(game => game.id), ['beam-dodge']);
    for (const game of catalog) {
        assert.ok(game.launchUrl);
        assert.ok(fs.existsSync(path.join(webRoot, 'wwwroot', game.launchUrl)));
        assert.ok(!game.imageUrl.includes('placeholders'));
    }
});

test('bundled game retains its source/genre categories and launch target', () => {
    const dodge = catalog[0];
    assert.deepEqual(dodge.categoryIds, ['homemade', 'arcade']);
    assert.equal(dodge.launchUrl, '/games/beam-dodge/index.html');
});

test('covers are small local SVGs and the generic cover has no fictional game title', () => {
    for (const imageUrl of [...catalog.map(game => game.imageUrl), '/images/games/default-cover.svg']) {
        const source = fs.readFileSync(path.join(webRoot, 'wwwroot', imageUrl), 'utf8');
        assert.ok(Buffer.byteLength(source) < 4096);
        assert.match(source, /<svg\b/);
        assert.match(source, /viewBox="0 0 600 600"/);
        assert.doesNotMatch(source, /<filter|<image|<linearGradient|<radialGradient|<script|placeholder/i);
    }
    const cover = fs.readFileSync(path.join(webRoot, 'wwwroot/images/games/default-cover.svg'), 'utf8');
    assert.match(cover, />BEAM</);
    assert.doesNotMatch(cover, /runner|orbit|turbo|tekken/i);
});

test('running selector starts with all real games and groups the same entries by category', {
    skip: !process.env.BEAM_TEST_URL
}, async () => {
    const base = process.env.BEAM_TEST_URL.replace(/\/$/, '');
    const response = await fetch(`${base}/GameSlider`);
    assert.equal(response.status, 200);
    const html = await response.text();
    const attributes = markup => Object.fromEntries([...markup.matchAll(/([\w-]+)="([^"]*)"/g)]
        .map(match => [match[1], match[2]]));
    const views = [...html.matchAll(/<div data-id="([^"]+)" data-name="([^"]+)"[^>]*>([\s\S]*?)<\/div>/g)]
        .map(match => ({ id: match[1], name: match[2], games: [...match[3].matchAll(/<span\s+([^>]*)>/g)]
            .map(span => attributes(span[1])) }));
    assert.equal(views[0].id, 'all');
    const all = views[0].games;
    assert.equal(new Set(all.map(game => game['data-id'])).size, all.length);
    for (const game of all) {
        assert.ok(game['data-launch'], 'Every game has a launch target');
        assert.ok(game['data-id'] === 'beam-dodge' || /^uploaded-\d+$/.test(game['data-id']), 'No fictional catalog entries');
    }
    assert.deepEqual(views.map(view => view.id), Object.keys(categoryNames).filter(id => id === 'all' || all.some(game => game['data-categories'].split(',').includes(id))));
    for (const view of views) {
        assert.equal(view.name, categoryNames[view.id]);
        const expected = view.id === 'all' ? all : all.filter(game => game['data-categories'].split(',').includes(view.id));
        assert.deepEqual(view.games, expected);
    }
    for (const bundled of catalog) {
        const rendered = all.find(game => game['data-id'] === bundled.id);
        assert.ok(rendered);
        assert.equal(rendered['data-image'], bundled.imageUrl);
    }
    for (const asset of new Set(all.map(game => game['data-image']))) {
        const cover = await fetch(base + asset);
        assert.equal(cover.status, 200, asset);
        assert.ok((await cover.arrayBuffer()).byteLength > 0, asset);
    }
});

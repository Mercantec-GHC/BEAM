const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const webRoot = path.join(__dirname, '../src/BEAM.Web');
const catalog = JSON.parse(fs.readFileSync(path.join(webRoot, 'Data/demo-games.json'), 'utf8'));
const categoryIds = ['homemade', 'roms', 'arcade', 'fighter'];
const inCategory = id => catalog.filter(game => game.categoryIds.includes(id));

test('each requested category has exactly ten unique games', () => {
    for (const id of categoryIds) {
        const games = inCategory(id);
        assert.equal(games.length, 10, id);
        assert.equal(new Set(games.map(game => game.id)).size, 10, id);
    }
    assert.equal(catalog.length, 20, 'Twenty shared games fill forty category positions');
    assert.equal(new Set(catalog.map(game => game.id)).size, catalog.length);
});

test('one game can belong to source and genre categories, including future genres', () => {
    assert.equal(inCategory('homemade').filter(game => game.categoryIds.includes('fighter')).length, 5);
    assert.equal(inCategory('roms').filter(game => game.categoryIds.includes('fighter')).length, 5);
    assert.ok(inCategory('roms').some(game => game.categoryIds.includes('racing')));
    const dodge = catalog.find(game => game.id === 'beam-dodge');
    assert.ok(inCategory('homemade').includes(dodge));
    assert.ok(inCategory('arcade').includes(dodge));
    assert.equal(dodge.launchUrl, '/games/beam-dodge/index.html');
});

test('every unique game has a distinct, small local SVG cover', () => {
    assert.equal(new Set(catalog.map(game => game.imageUrl)).size, catalog.length);
    let totalBytes = 0;
    for (const game of catalog) {
        const assetPath = path.join(webRoot, 'wwwroot', game.imageUrl.replace(/^\//, ''));
        const source = fs.readFileSync(assetPath, 'utf8');
        const bytes = Buffer.byteLength(source);
        assert.ok(bytes < 4096, `${game.id}: cover exceeds 4 KB`);
        assert.match(source, /<svg\b/);
        assert.match(source, /viewBox="0 0 600 600"/);
        assert.doesNotMatch(source, /<filter|<image|<linearGradient|<radialGradient|<script/i);
        totalBytes += bytes;
    }
    assert.ok(totalBytes < 64 * 1024, 'The entire placeholder set stays below 64 KB');
});

test('running Blazor category views match the shared catalog and serve every cover', {
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
    assert.deepEqual(views.map(view => view.id), categoryIds);
    assert.deepEqual(views.map(view => view.name), ['Homemade', 'ROMS', 'Arcade', 'Fighter']);
    for (const view of views) {
        assert.equal(view.games.length, 10);
        assert.deepEqual(view.games.map(game => game['data-id']), inCategory(view.id).map(game => game.id));
        for (const game of view.games) {
            const original = catalog.find(item => item.id === game['data-id']);
            assert.equal(game['data-image'], original.imageUrl);
            assert.ok(game['data-categories'].split(',').includes(view.id));
        }
    }
    await Promise.all(catalog.map(async game => {
        const cover = await fetch(`${base}${game.imageUrl}`);
        assert.equal(cover.status, 200, game.imageUrl);
        assert.match(await cover.text(), /<svg\b/);
    }));
});

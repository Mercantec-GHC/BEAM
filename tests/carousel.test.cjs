const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname,
    '../src/BEAM.Web/Components/Games/GameCoverFlow.razor.js'), 'utf8');

// Exercise the real event handlers and frame scheduler without a browser dependency.
function setup(counts = 7) {
    class Element {
        constructor() { this.dataset = {}; this.style = {}; this.attributes = {}; this.events = {}; }
        addEventListener(type, handler, options = {}) {
            (this.events[type] ??= []).push({ handler, signal: options.signal });
        }
        emit(type, data = {}) {
            const event = { preventDefault() {}, ...data };
            for (const { handler, signal } of this.events[type] ?? []) {
                if (!signal?.aborted) handler(event);
            }
        }
        setAttribute(name, value) { this.attributes[name] = String(value); }
        removeAttribute(name) { delete this.attributes[name]; if (name === 'src') delete this.src; }
        focus() {}
    }
    const mod = (n, length) => ((n % length) + length) % length;
    const sizes = Array.isArray(counts) ? counts : [counts];
    const names = ['Homemade', 'ROMS', 'Empty', 'Solo'];
    const categories = sizes.map((count, category) => ({
        dataset: { id: `category-${category}`, name: names[category] || `Category ${category}` },
        children: Array.from({ length: count }, (_, i) => ({ dataset: {
            title: category === 0 ? `Game ${i}` : `Category ${category} Game ${i}`,
            image: `/cat-${category}/cover-${i}.svg`,
            ...(i === 2 ? { launch: category === 0 ? '/games/two' : '/roms/two' } : {})
        } }))
    }));
    const initialGames = categories[0]?.children ?? [];
    const cards = Array.from({ length: 7 }, (_, i) => {
        const card = new Element();
        const slot = i - 3;
        card.dataset = { slot: String(slot), index: String(initialGames.length ? mod(slot, initialGames.length) : -1) };
        card.image = new Element();
        card.querySelector = () => card.image;
        return card;
    });
    const stage = new Element();
    const nodes = { '.selection-status': new Element(), '.category-name': new Element(), '.category-empty': new Element() };
    nodes['.game-data'] = { children: categories };
    nodes['.flow-stage'] = stage;
    const frames = new Map();
    let frameId = 0;
    let Carousel;
    const launches = [];
    vm.runInNewContext(source, {
        HTMLElement: Element,
        window: { location: { assign(url) { launches.push(url); } } },
        MutationObserver: class { observe() {} disconnect() {} },
        AbortController,
        document: { activeElement: null },
        getComputedStyle() { throw new Error('Navigation must not read computed styles'); },
        requestAnimationFrame(callback) { frames.set(++frameId, callback); return frameId; },
        cancelAnimationFrame(id) { frames.delete(id); },
        customElements: { get() {}, define(name, component) { Carousel = component; } }
    });
    const root = new Carousel();
    root.querySelector = selector => nodes[selector];
    root.querySelectorAll = () => cards;
    root.connectedCallback();
    const flush = () => {
        const callbacks = [...frames.values()];
        frames.clear();
        callbacks.forEach(callback => callback());
    };
    let time = 0;
    const key = (key, extra = {}) => root.emit('keydown', { key, timeStamp: time += 150, ...extra });
    const selected = () => cards.find(card => card.attributes['aria-pressed'] === 'true');
    return { root, cards, stage, nodes, frames, flush, key, selected, launches };
}

test('wraps both directions and preserves the bounded seven-image ring with five visible covers under repeated input', () => {
    for (const count of [2, 7, 1000]) {
        const app = setup(count);
        app.key('ArrowLeft'); app.flush();
        assert.equal(Number(app.selected().dataset.index), count - 1);
        for (let i = 0; i < 301; i++) { app.key('ArrowRight'); app.flush(); }
        assert.equal(Number(app.selected().dataset.index), 300 % count);
        assert.equal(app.cards.length, 7);
        assert.equal(new Set(app.cards.map(card => Number(card.dataset.slot))).size, 7);
        assert.equal(app.frames.size, 0, 'No continuous animation loop at rest');
    }
});

test('coalesces rapid key presses into one frame without losing navigation steps', () => {
    const app = setup();
    for (let i = 0; i < 100; i++) app.key('ArrowRight');
    assert.equal(app.frames.size, 1);
    app.flush();
    assert.equal(Number(app.selected().dataset.index), 100 % 7);
    assert.equal(app.frames.size, 0);
});

test('held keys are rate limited; release and distinct presses remain immediate', () => {
    const app = setup();
    app.key('ArrowRight', { timeStamp: 0 }); app.flush();
    for (let time = 10; time < 180; time += 10) {
        app.key('ArrowRight', { timeStamp: time, repeat: true });
    }
    assert.equal(app.frames.size, 0);
    app.key('ArrowRight', { timeStamp: 180, repeat: true }); app.flush();
    assert.equal(Number(app.selected().dataset.index), 2);
    app.key('ArrowLeft', { timeStamp: 181 }); app.flush();
    assert.equal(Number(app.selected().dataset.index), 1);
});

test('Home/End and playable game metadata stay synchronized', () => {
    const app = setup();
    app.key('End'); app.flush();
    assert.equal(Number(app.selected().dataset.index), 6);
    app.key('Home'); app.flush();
    assert.equal(Number(app.selected().dataset.index), 0);
    app.key('ArrowRight'); app.flush();
    app.key('ArrowRight'); app.flush();
    assert.equal(app.nodes['.selection-status'].textContent, 'Homemade: Game 2');
    app.key('Enter');
    assert.deepEqual(app.launches, ['/games/two']);
    app.key('ArrowRight'); app.flush();
    assert.equal(app.nodes['.selection-status'].textContent, 'Homemade: Game 3');
    app.key('Enter');
    assert.deepEqual(app.launches, ['/games/two'], 'Unavailable games are not launched');
});

test('empty/single game catalogs and disconnection do not leave work scheduled', () => {
    const empty = setup(0);
    assert.equal(empty.frames.size, 0);
    empty.root.disconnectedCallback();
    const single = setup(1);
    single.key('ArrowRight'); single.flush();
    assert.equal(single.cards.length, 7);
    assert.equal(Number(single.selected().dataset.index), 0);
    assert.equal(single.cards.filter(card => card.attributes['aria-hidden'] === 'false').length, 1);
    assert.equal(single.frames.size, 0);
    const app = setup();
    app.key('ArrowRight');
    app.root.disconnectedCallback();
    assert.equal(app.frames.size, 0);
    app.key('ArrowRight');
    assert.equal(app.frames.size, 0, 'Disconnected handlers are removed');
});



test('navigation delegates all geometry to CSS and keeps five visible covers', () => {
    const app = setup();
    app.key('ArrowRight'); app.flush();
    const center = app.selected();
    assert.equal(Number(center.dataset.slot), 0);
    assert.equal(app.cards.filter(card => card.attributes['aria-hidden'] === 'false').length, 5);
    for (const card of app.cards) {
        assert.equal(card.style.transform, undefined);
        assert.equal(card.style.opacity, undefined);
        assert.equal(Number(card.style.zIndex), 10 - Math.abs(Number(card.dataset.slot)));
    }
});




test('last-to-first wrapping uses the same slide and only teleports invisible buffers', () => {
    const app = setup();
    app.key('End'); app.flush();
    assert.equal(Number(app.selected().dataset.index), 6);
    for (let step = 0; step < 2; step++) {
        const before = app.cards.map(card => Number(card.dataset.slot));
        app.key('ArrowRight'); app.flush();
        assert.equal(Number(app.selected().dataset.index), step);
        app.cards.forEach((card, i) => {
            const slot = Number(card.dataset.slot);
            if (slot !== before[i] - 1) {
                assert.equal(before[i], -3);
                assert.equal(slot, 3);
                assert.equal(card.attributes['aria-hidden'], 'true');
                assert.equal(card.style.transition, 'none');
            } else {
                assert.equal(card.style.transition, '');
            }
        });
    }
});


test('Up cycles categories, remembers selections and swaps artwork even when indices match', () => {
    const app = setup([7, 3]);
    assert.equal(app.nodes['.category-name'].textContent, 'Homemade');
    app.key('ArrowRight'); app.flush();
    app.key('ArrowRight'); app.flush();
    app.key('ArrowUp');
    assert.equal(app.nodes['.category-name'].textContent, 'ROMS');
    assert.equal(Number(app.selected().dataset.index), 0);
    assert.equal(app.selected().image.src, '/cat-1/cover-0.svg');
    app.key('ArrowLeft'); app.flush();
    assert.equal(Number(app.selected().dataset.index), 2, 'Wrapping stays inside ROMS');
    app.key('Enter');
    assert.deepEqual(app.launches, ['/roms/two']);
    app.key('ArrowUp');
    assert.equal(app.nodes['.category-name'].textContent, 'Homemade');
    assert.equal(Number(app.selected().dataset.index), 2);
    assert.equal(app.selected().image.src, '/cat-0/cover-2.svg');
    app.key('Enter');
    assert.deepEqual(app.launches, ['/roms/two', '/games/two']);
    app.key('ArrowUp');
    assert.equal(Number(app.selected().dataset.index), 2, 'ROMS also remembers its selection');
    assert.equal(app.cards.length, 7);
    assert.equal(app.frames.size, 0);
});

test('held Up does not oscillate categories, and queued horizontal input cannot leak across categories', () => {
    const app = setup([7, 3]);
    app.key('ArrowRight'); // Do not flush the queued input before switching.
    app.key('ArrowUp');
    assert.equal(app.frames.size, 0);
    app.key('ArrowUp', { repeat: true });
    assert.equal(app.nodes['.category-name'].textContent, 'ROMS');
    assert.equal(Number(app.selected().dataset.index), 0);
    app.flush();
    assert.equal(Number(app.selected().dataset.index), 0);
    app.key('ArrowUp');
    assert.equal(Number(app.selected().dataset.index), 1, 'Pending selection was remembered in Homemade');
});

test('empty and single-game categories remain navigable without stale covers or launches', () => {
    const app = setup([7, 0, 1]);
    app.key('ArrowUp');
    assert.equal(app.nodes['.category-empty'].hidden, false);
    assert.equal(app.selected(), undefined);
    for (const card of app.cards) {
        assert.equal(card.attributes['aria-hidden'], 'true');
        assert.equal(card.image.src, undefined);
    }
    app.key('ArrowLeft'); app.key('Home'); app.key('End'); app.key('Enter');
    assert.equal(app.frames.size, 0);
    assert.deepEqual(app.launches, []);
    app.key('ArrowUp');
    assert.equal(app.nodes['.category-empty'].hidden, true);
    assert.equal(Number(app.selected().dataset.index), 0);
    assert.equal(app.cards.filter(card => card.attributes['aria-hidden'] === 'false').length, 1);
    app.key('ArrowRight');
    assert.equal(app.frames.size, 0);
    app.key('ArrowUp');
    assert.equal(app.nodes['.category-name'].textContent, 'Homemade');
    assert.equal(app.cards.filter(card => card.attributes['aria-hidden'] === 'false').length, 5);
});

test('Down wraps categories backwards and restores each category selection', () => {
    const app = setup([7, 3, 2, 4]);
    app.key('ArrowRight'); app.flush();
    app.key('ArrowDown');
    assert.equal(app.nodes['.category-name'].textContent, 'Solo');
    assert.equal(app.root.dataset.categoryDirection, 'down');
    app.key('ArrowRight'); app.flush();
    app.key('ArrowRight'); app.flush();
    app.key('ArrowUp');
    assert.equal(app.nodes['.category-name'].textContent, 'Homemade');
    assert.equal(Number(app.selected().dataset.index), 1);
    assert.equal(app.root.dataset.categoryDirection, 'up');
    app.key('ArrowDown');
    assert.equal(Number(app.selected().dataset.index), 2);
    app.key('ArrowDown');
    assert.equal(app.nodes['.category-name'].textContent, 'Empty');
    app.key('ArrowDown');
    assert.equal(app.nodes['.category-name'].textContent, 'ROMS');
    assert.equal(app.cards.length, 7);
    assert.equal(app.frames.size, 0);
});

test('category motion restarts with alternating CSS names and no JavaScript animation loop', () => {
    const app = setup([7, 3, 2]);
    app.key('ArrowUp');
    const first = app.root.dataset.categoryMotion;
    app.key('ArrowUp');
    assert.notEqual(app.root.dataset.categoryMotion, first);
    app.key('ArrowDown');
    assert.equal(app.root.dataset.categoryMotion, first);
    assert.equal(app.root.dataset.categoryDirection, 'down');
    assert.equal(app.frames.size, 0);
    app.key('ArrowDown', { repeat: true });
    assert.equal(app.root.dataset.categoryMotion, first);
    assert.equal(app.nodes['.category-name'].textContent, 'ROMS');
});

test('single-category catalog does not start category motion for Up or Down', () => {
    const app = setup(7);
    app.key('ArrowUp'); app.key('ArrowDown');
    assert.equal(app.root.dataset.categoryMotion, undefined);
    assert.equal(app.nodes['.category-name'].textContent, 'Homemade');
    assert.equal(app.frames.size, 0);
});

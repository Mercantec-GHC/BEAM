const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname,
    '../src/BEAM.Web/Components/Games/GameCoverFlow.razor.js'), 'utf8');

// Exercise the real event handlers and frame scheduler without a browser dependency.
function setup(count = 7) {
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
        removeAttribute(name) { delete this.attributes[name]; }
        focus() {}
    }
    const mod = (n, length) => ((n % length) + length) % length;
    const games = Array.from({ length: count }, (_, i) => ({ dataset: {
        title: `Game ${i}`, genre: `Genre ${i}`, image: `/cover-${i}.svg`,
        ...(i === 2 ? { launch: '/games/two' } : {})
    } }));
    const cards = count ? Array.from({ length: count === 1 ? 1 : 7 }, (_, i) => {
        const card = new Element();
        const slot = count === 1 ? 0 : i - 3;
        card.dataset = { slot: String(slot), index: String(mod(slot, count)) };
        card.image = {};
        card.querySelector = () => card.image;
        return card;
    }) : [];
    const stage = new Element();
    const nodes = { '.selection-status': new Element() };
    nodes['.game-data'] = { children: games };
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
    assert.equal(app.nodes['.selection-status'].textContent, 'Game 2');
    app.key('Enter');
    assert.deepEqual(app.launches, ['/games/two']);
    app.key('ArrowRight'); app.flush();
    assert.equal(app.nodes['.selection-status'].textContent, 'Game 3');
    app.key('Enter');
    assert.deepEqual(app.launches, ['/games/two'], 'Unavailable games are not launched');
});

test('empty/single game catalogs and disconnection do not leave work scheduled', () => {
    const empty = setup(0);
    assert.equal(empty.frames.size, 0);
    empty.root.disconnectedCallback();
    const single = setup(1);
    single.key('ArrowRight'); single.flush();
    assert.equal(single.cards.length, 1);
    assert.equal(single.cards[0].dataset.index, '0');
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

const mod = (value, count) => ((value % count) + count) % count;

class BeamCoverFlow extends HTMLElement {
    connectedCallback() {
        this.observer = new MutationObserver(() => this.initialize());
        this.observer.observe(this, { childList: true, subtree: true });
        this.initialize();
    }

    initialize() {
        const template = this.querySelector('.game-data');
        const stage = this.querySelector('.flow-stage');
        const status = this.querySelector('.selection-status');
        const categoryLabel = this.querySelector('.category-name');
        const empty = this.querySelector('.category-empty');
        if (!template || !stage || !status || !categoryLabel || !empty) return;
        const categories = [...template.children].map(node => ({
            id: node.dataset.id,
            name: node.dataset.name,
            games: [...node.children].map(game => ({ ...game.dataset }))
        }));
        const cards = [...this.querySelectorAll('.game-cover')];
        if (!categories.length || cards.length !== 7) return;
        this.observer.disconnect();
        this.controller = new AbortController();
        const options = { signal: this.controller.signal };
        const images = cards.map(card => card.querySelector('img'));
        const remembered = new Array(categories.length).fill(0);
        let categoryIndex = 0;
        let games = categories[0].games;
        let selected = 0;
        let pending = 0;
        let start = null;
        let dragged = false;
        let pointerId = null;
        let lastRepeatedKey = -Infinity;
        let categoryMotion = false;

        const paint = (delta, reset = false) => {
            // Only seven image nodes are reused across all categories. CSS owns motion;
            // category changes replace artwork directly, without animating an entire catalog.
            cards.forEach((card, i) => {
                const oldSlot = Number(card.dataset.slot);
                const slot = reset ? i - 3 : mod(oldSlot - delta + 3, 7) - 3;
                const recycled = slot !== oldSlot - delta;
                const index = games.length ? mod(selected + slot, games.length) : -1;
                const game = games[index];
                card.dataset.slot = slot;
                card.dataset.id = game?.id ?? '';
                if (reset || Number(card.dataset.index) !== index) {
                    card.dataset.index = index;
                    card.setAttribute('aria-label', game ? `Select ${game.title}` : 'No game');
                    if (game) images[i].src = game.image;
                    else images[i].removeAttribute('src');
                    images[i].alt = game ? `${game.title} cover` : '';
                }
                const hidden = !game || (games.length === 1 ? slot !== 0 : Math.abs(slot) > 2);
                card.tabIndex = hidden ? -1 : 0;
                card.setAttribute('aria-hidden', String(hidden));
                card.setAttribute('aria-pressed', String(!!game && slot === 0));
                if (hidden && document.activeElement === card) stage.focus({ preventScroll: true });
                card.style.transition = reset || recycled || Math.abs(delta) > 1 ? 'none' : '';
                card.style.zIndex = String(10 - Math.abs(slot));
            });
            const category = categories[categoryIndex];
            this.dataset.category = category.id;
            categoryLabel.textContent = category.name;
            empty.hidden = games.length > 0;
            status.textContent = `${category.name}: ${games.length ? games[selected].title : 'No games yet'}`;
        };
        const render = () => {
            this.frame = 0;
            const delta = pending;
            pending = 0;
            if (!delta || games.length < 2) return;
            selected = mod(selected + delta, games.length);
            paint(delta);
        };
        const move = delta => {
            if (games.length < 2 || !delta) return;
            pending += delta;
            if (!this.frame) this.frame = requestAnimationFrame(render);
        };
        const select = index => {
            if (!games.length) return;
            const current = mod(selected + pending, games.length);
            let delta = mod(index - current, games.length);
            if (delta > games.length / 2) delta -= games.length;
            move(delta);
        };
        const switchCategory = direction => {
            if (categories.length < 2) return;
            // Remember queued horizontal input before switching in either direction.
            remembered[categoryIndex] = games.length ? mod(selected + pending, games.length) : 0;
            cancelAnimationFrame(this.frame);
            this.frame = 0;
            pending = 0;
            categoryIndex = mod(categoryIndex + direction, categories.length);
            games = categories[categoryIndex].games;
            selected = games.length ? mod(remembered[categoryIndex], games.length) : 0;
            start = null;
            dragged = false;
            pointerId = null;
            lastRepeatedKey = -Infinity;
            paint(0, true);
            this.dataset.categoryDirection = direction > 0 ? 'up' : 'down';
            // Alternate animation names to restart CSS motion, even for repeated Up/Down.
            // No forced style reads, animation objects, timers, or extra frame loop.
            categoryMotion = !categoryMotion;
            this.dataset.categoryMotion = categoryMotion ? 'a' : 'b';
            stage.focus({ preventScroll: true });
        };
        this.addEventListener('keydown', event => {
            if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
                event.preventDefault();
                if (!event.repeat) switchCategory(event.key === 'ArrowUp' ? 1 : -1);
                return;
            }
            let delta;
            if (event.key === 'ArrowLeft') delta = -1;
            else if (event.key === 'ArrowRight') delta = 1;
            else if (event.key === 'Home' || event.key === 'End') {
                event.preventDefault();
                select(event.key === 'Home' ? 0 : games.length - 1);
                return;
            } else if (event.key === 'Enter') {
                event.preventDefault();
                const game = games.length ? games[mod(selected + pending, games.length)] : null;
                if (game?.launch) window.location.assign(game.launch);
                return;
            } else return;
            event.preventDefault();
            if (event.repeat && event.timeStamp - lastRepeatedKey < 180) return;
            lastRepeatedKey = event.timeStamp;
            move(delta);
        }, options);
        paint(0, true);
        stage.addEventListener('click', event => {
            if (dragged) { dragged = false; return; }
            const card = event.target.closest('.game-cover');
            if (card) move(Number(card.dataset.slot));
        }, options);
        stage.addEventListener('pointerdown', event => {
            if (!event.isPrimary || event.button !== 0) return;
            start = { x: event.clientX, y: event.clientY };
            pointerId = event.pointerId;
            dragged = false;
        }, options);
        stage.addEventListener('pointermove', event => {
            if (!start || event.pointerId !== pointerId) return;
            const x = event.clientX - start.x;
            if (Math.abs(x) > 12 && Math.abs(x) > Math.abs(event.clientY - start.y)) {
                dragged = true;
                if (!stage.hasPointerCapture(event.pointerId)) stage.setPointerCapture(event.pointerId);
            }
        }, options);
        stage.addEventListener('pointerup', event => {
            if (!start || event.pointerId !== pointerId) return;
            const x = event.clientX - start.x;
            if (dragged && Math.abs(x) >= 35) move(x < 0 ? 1 : -1);
            start = null;
            pointerId = null;
            if (stage.hasPointerCapture(event.pointerId)) stage.releasePointerCapture(event.pointerId);
        }, options);
        const cancelSwipe = () => { start = null; pointerId = null; };
        stage.addEventListener('pointercancel', cancelSwipe, options);
        stage.addEventListener('lostpointercapture', cancelSwipe, options);
        this.dataset.ready = 'true';
    }

    disconnectedCallback() {
        this.observer?.disconnect();
        this.controller?.abort();
        cancelAnimationFrame(this.frame);
        this.frame = 0;

    }
}

if (!customElements.get('beam-cover-flow')) customElements.define('beam-cover-flow', BeamCoverFlow);

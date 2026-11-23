const mod = (value, count) => ((value % count) + count) % count;

class BeamCoverFlow extends HTMLElement {
    connectedCallback() {
        // The initial import upgrades the fully rendered element. On later Blazor
        // navigation, children may arrive after connectedCallback, so wait for them.
        this.observer = new MutationObserver(() => this.initialize());
        this.observer.observe(this, { childList: true, subtree: true });
        this.initialize();
    }

    initialize() {
        const template = this.querySelector('.game-data');
        const stage = this.querySelector('.flow-stage');
        if (!template || !stage || !this.querySelector('.selection-status')) return;
        const games = [...template.children].map(node => ({ ...node.dataset }));
        const cards = [...this.querySelectorAll('.game-cover')];
        if (!games.length || cards.length !== (games.length === 1 ? 1 : 7)) return;
        this.observer.disconnect();
        this.controller = new AbortController();
        const options = { signal: this.controller.signal };
        const status = this.querySelector('.selection-status');
        const images = cards.map(card => card.querySelector('img'));
        let selected = 0;
        let pending = 0;
        let start = null;
        let dragged = false;
        let pointerId = null;
        let lastRepeatedKey = -Infinity;

        const render = () => {
            this.frame = 0;
            const delta = pending;
            pending = 0;
            if (!delta || games.length === 1) return;
            selected = mod(selected + delta, games.length);
            // Write targets once per input frame. CSS owns interpolation and interruption;
            // no computed-style reads, animation objects, or JavaScript work per animation frame.
            cards.forEach((card, i) => {
                const oldSlot = Number(card.dataset.slot);
                const slot = mod(oldSlot - delta + 3, 7) - 3;
                const recycled = slot !== oldSlot - delta;
                const index = mod(selected + slot, games.length);
                const game = games[index];

                card.dataset.slot = slot;
                if (Number(card.dataset.index) !== index) {
                    card.dataset.index = index;
                    card.setAttribute('aria-label', `Select ${game.title}`);
                    const image = images[i];
                    image.src = game.image;
                    image.alt = `${game.title} cover`;
                }
                const hidden = Math.abs(slot) > 2;
                card.tabIndex = hidden ? -1 : 0;
                card.setAttribute('aria-hidden', String(hidden));
                card.setAttribute('aria-pressed', String(slot === 0));
                if (hidden && document.activeElement === card) stage.focus({ preventScroll: true });
                // Recycle directly between the hidden edges. On the next move the browser
                // transitions from that committed edge position; no forced layout is needed.
                card.style.transition = recycled || Math.abs(delta) > 1 ? 'none' : '';
                card.style.zIndex = String(10 - Math.abs(slot));
            });
            status.textContent = games[selected].title;
        };
        const move = delta => {
            pending += delta;
            if (!this.frame) this.frame = requestAnimationFrame(render);
        };
        const select = index => {
            const current = mod(selected + pending, games.length);
            let delta = mod(index - current, games.length);
            if (delta > games.length / 2) delta -= games.length;
            move(delta);
        };
        this.addEventListener('keydown', event => {
            let delta;
            if (event.key === 'ArrowLeft') delta = -1;
            else if (event.key === 'ArrowRight') delta = 1;
            else if (event.key === 'Home' || event.key === 'End') {
                event.preventDefault();
                select(event.key === 'Home' ? 0 : games.length - 1);
                return;
            } else if (event.key === 'Enter') {
                event.preventDefault();
                const game = games[mod(selected + pending, games.length)];
                if (game.launch) window.location.assign(game.launch);
                return;
            } else return;
            event.preventDefault();
            // Limit OS key repeat, while allowing distinct key presses immediately.
            if (event.repeat && event.timeStamp - lastRepeatedKey < 180) return;
            lastRepeatedKey = event.timeStamp;
            move(delta);
        }, options);
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








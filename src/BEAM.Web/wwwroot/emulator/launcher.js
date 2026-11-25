(() => {
    const start = document.querySelector('#start');
    const retry = document.querySelector('#retry');
    const status = document.querySelector('#status');
    const frame = document.querySelector('#player');
    let romUrl;
    let timer;
    const gameId = new URLSearchParams(location.search).get('game');
    const arcade = new URLSearchParams(location.search).get('arcade') === '1';
    document.body.classList.toggle('arcade', arcade);
    let savedGame;
    const setup = document.querySelector('#setup');
    const localControls = [...setup.children].filter(element => element !== start);
    if (gameId !== null) {
        start.disabled = true;
        localControls.forEach(element => element.hidden = true);
        document.querySelector('h1').textContent = 'Loading game…';
        document.title = 'Game player · BEAM';
        (async () => {
            try {
                if (!/^\d+$/.test(gameId)) throw new Error('Invalid game link. Return to the game library.');
                const response = await fetch(`/emulator/games/${gameId}`, { cache: 'no-store' });
                if (!response.ok) throw new Error('Game unavailable. It may have been removed. Return to the game library.');
                savedGame = await response.json();
                document.querySelector('h1').textContent = savedGame.title;
                document.title = `${savedGame.title} · BEAM`;
                start.textContent = `Start ${savedGame.title}`;
                for (const [id, value] of [['game-warning', savedGame.warning], ['control-notes', savedGame.controlNotes]]) {
                    const element = document.getElementById(id);
                    element.textContent = value || '';
                    element.hidden = !value;
                }
                status.textContent = 'Ready. Start the game to load its emulator.';
                start.disabled = false;
                if (arcade) start.click();
            } catch (error) { status.textContent = error.message; document.querySelector('h1').textContent = 'Game unavailable'; }
        })();
    }
    function reset() {
        clearTimeout(timer);
        frame.src = 'about:blank';
        frame.hidden = true;
        document.body.classList.remove('playing');
        if (romUrl) URL.revokeObjectURL(romUrl);
        romUrl = undefined;
        document.querySelector('#setup').hidden = false;
        retry.hidden = true;
        start.disabled = false;
    }
    retry.onclick = () => { reset(); status.textContent = savedGame ? 'Ready. Start the game to load its emulator.' : 'Ready. Select a ROM or use the installed copy.'; };
    start.onclick = async () => {
        start.disabled = true;
        status.textContent = 'Checking ROM…';
        try {
            const file = document.querySelector('#rom').files[0];
            let url = savedGame?.romUrl || '/roms/tektagt.zip';
            if (gameId && !savedGame) throw new Error('Game configuration is unavailable. Return to the game library.');
            if (file && !savedGame) {
                if (file.name.toLowerCase() !== 'tektagt.zip') throw new Error('Choose tektagt.zip. Other games and clone sets are not configured here.');
                const bytes = new Uint8Array(await file.slice(0, 4).arrayBuffer());
                if (bytes[0] !== 0x50 || bytes[1] !== 0x4b || bytes[2] !== 3 || bytes[3] !== 4) throw new Error('The selected file is not a ZIP ROM archive.');
                url = romUrl = URL.createObjectURL(file);
            } else {
                const response = await fetch(url, { method: 'HEAD', cache: 'no-store' });
                if (!response.ok || response.headers.get('content-type')?.includes('text/html')) throw new Error(savedGame ? 'The saved ROM is missing. Re-add the game in the library.' : 'No installed ROM found. Select your tektagt.zip file to play.');
            }
            document.querySelector('#setup').hidden = true;
            retry.hidden = false;
            frame.hidden = false;
            document.body.classList.add('playing');
            frame.src = savedGame ? `runtime.html?game=${encodeURIComponent(gameId)}` : `runtime.html?rom=${encodeURIComponent(url)}`;
            retry.textContent = savedGame ? 'Restart game' : 'Choose another ROM / restart';
            status.textContent = 'Loading EmulatorJS…';
            timer = setTimeout(() => { status.textContent = 'Loading is taking longer than expected. Check your connection and game compatibility, then restart.'; }, 120000);
        } catch (error) { reset(); status.textContent = error.message; }
    };
    window.addEventListener('message', event => {
        if (event.origin !== location.origin || event.source !== frame.contentWindow || event.data?.type !== 'beam-emulator') return;
        if (event.data.state === 'ready') {
            clearTimeout(timer);
            status.textContent = 'Emulator ready. Starting game; configure controls in its menu.';
        } else if (event.data.state === 'error') {
            clearTimeout(timer);
            if (arcade) reset();
            status.textContent = 'Emulator failed to load. Check your connection and ROM compatibility, then restart.';
        }
    });
    window.addEventListener('pagehide', () => { if (romUrl) URL.revokeObjectURL(romUrl); });
})();

(async () => {
    const notify = state => parent.postMessage({ type: 'beam-emulator', state }, location.origin);
    try {
        const params = new URLSearchParams(location.search);
        const id = params.get('game');
        if (id !== null) {
            if (!/^\d+$/.test(id)) throw new Error('Invalid game.');
            const response = await fetch(`/emulator/games/${id}`, { cache: 'no-store' });
            if (!response.ok) throw new Error('Game unavailable.');
            const game = await response.json();
            const asset = /^\/game-assets\/[a-f0-9]{32}\/[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/;
            if (!asset.test(game.romUrl) || (game.biosUrl && !asset.test(game.biosUrl))) throw new Error('Invalid game assets.');
            window.EJS_core = game.core;
            window.EJS_gameName = `BEAM-${game.id}-${game.title}`;
            window.EJS_gameID = game.id;
            window.EJS_gameUrl = game.romUrl;
            if (game.biosUrl) window.EJS_biosUrl = game.biosUrl;
        } else {
            // Preserve the standalone Tekken compatibility test and local-file player.
            const rom = params.get('rom');
            if (rom !== '/roms/tektagt.zip' && !rom?.startsWith(`blob:${location.origin}/`)) throw new Error('Invalid ROM.');
            window.EJS_core = 'mame2003_plus';
            window.EJS_gameName = 'tektagt.zip'; // Blob URLs have no filename; arcade archives need the suffix.
            window.EJS_gameUrl = rom;
        }
    } catch {
        document.querySelector('#game').textContent = 'Game unavailable. Return to the BEAM game library.';
        notify('error');
        return;
    }
    window.EJS_player = '#game';
    window.EJS_pathtodata = 'https://cdn.emulatorjs.org/4.2.3/data/';
    window.EJS_startOnLoaded = true;
    window.EJS_Buttons = Object.fromEntries([
        'playPause', 'restart', 'mute', 'settings', 'fullscreen', 'saveState',
        'loadState', 'screenRecord', 'gamepad', 'cheat', 'volume', 'saveSavFiles',
        'loadSavFiles', 'quickSave', 'quickLoad', 'screenshot', 'cacheManager', 'exitEmulation'
    ].map(name => [name, false]));
    window.EJS_disableAutoLang = false;
    window.EJS_ready = () => notify('ready');
    window.addEventListener('error', () => notify('error'));
    window.addEventListener('unhandledrejection', () => notify('error'));
    const loader = document.createElement('script');
    loader.src = `${window.EJS_pathtodata}loader.js`;
    loader.onerror = () => notify('error');
    document.body.append(loader);
})();

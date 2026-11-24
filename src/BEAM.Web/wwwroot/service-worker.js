const SHELL = 'beam-shell-v1';
const GAME = 'beam-game-dodge-v1';
const SHELL_FILES = ['/play/index.html', '/play/library.js', '/play/style.css', '/offline.html',
    '/pwa.js', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png'];
const GAME_FILES = ['/games/beam-dodge/index.html', '/games/beam-dodge/game.js'];

self.addEventListener('install', event => {
    event.waitUntil(caches.open(SHELL).then(cache => cache.addAll(SHELL_FILES)));
});
self.addEventListener('activate', event => {
    event.waitUntil((async () => {
        for (const name of await caches.keys()) {
            if (name.startsWith('beam-shell-') && name !== SHELL) await caches.delete(name);
        }
        await self.clients.claim();
    })());
});
self.addEventListener('message', event => {
    event.waitUntil((async () => {
        try {
            if (event.data?.type === 'DOWNLOAD_DODGE') {
                // addAll is atomic: failed downloads don't leave a partly playable game.
                const cache = await caches.open(GAME);
                await cache.addAll(GAME_FILES);
            } else if (event.data?.type === 'REMOVE_DODGE') {
                await caches.delete(GAME);
            }
            const cache = await caches.open(GAME);
            const downloaded = (await Promise.all(GAME_FILES.map(path => cache.match(path)))).every(Boolean);
            event.ports[0]?.postMessage({ ok: true, downloaded });
        } catch {
            event.ports[0]?.postMessage({ ok: false, error: 'Download failed. Check your connection and available storage.' });
        }
    })());
});
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);
    if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
    // Never cache server-rendered Blazor pages, circuits, health probes, or database data.
    if (SHELL_FILES.includes(url.pathname) || GAME_FILES.includes(url.pathname)) {
        event.respondWith((async () => {
            const cached = await caches.match(url.pathname);
            if (cached) return cached;
            try { return await fetch(event.request); }
            catch { return (await caches.match('/offline.html')) ?? Response.error(); }
        })());
    } else if (event.request.mode === 'navigate') {
        event.respondWith(fetch(event.request).catch(async () =>
            (await caches.match('/offline.html')) ?? Response.error()));
    }
});

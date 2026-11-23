const status = document.querySelector('#status');
const download = document.querySelector('#download');
const remove = document.querySelector('#remove');
let worker;
function connection() { document.querySelector('#connection').textContent = navigator.onLine ? 'Connected to a network' : 'Offline — downloaded games still work'; }
connection();
window.addEventListener('online', connection);
window.addEventListener('offline', connection);
function request(type) {
    return new Promise((resolve, reject) => {
        const channel = new MessageChannel();
        const timeout = setTimeout(() => reject(new Error('Offline setup timed out. Reload and try again.')), 120000);
        channel.port1.onmessage = event => { clearTimeout(timeout); channel.port1.close(); resolve(event.data); };
        worker.postMessage({ type }, [channel.port2]);
    });
}
async function update(type) {
    download.disabled = remove.disabled = true;
    status.textContent = type === 'DOWNLOAD_DODGE' ? 'Downloading game…' : 'Checking library…';
    try {
        const result = await request(type);
        if (!result.ok) throw new Error(result.error);
        document.querySelector('#download-state').textContent = result.downloaded ? 'Downloaded — ready for offline play' : 'Not downloaded';
        status.textContent = 'Library ready';
        if (type === 'DOWNLOAD_DODGE') await navigator.storage?.persist?.();
    } catch (error) { status.textContent = error.message; }
    finally { download.disabled = remove.disabled = false; }
}
download.onclick = () => update('DOWNLOAD_DODGE');
remove.onclick = () => update('REMOVE_DODGE');
(async () => {
    if (!('serviceWorker' in navigator) || !window.isSecureContext) {
        status.textContent = 'Offline downloads require HTTPS (or localhost on this computer).';
        return;
    }
    const registration = await navigator.serviceWorker.ready;
    worker = registration.active;
    await update('STATUS');
})();
let installPrompt;
window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault(); installPrompt = event; document.querySelector('#install').hidden = false;
});
document.querySelector('#install').onclick = async () => {
    await installPrompt.prompt(); installPrompt = null; document.querySelector('#install').hidden = true;
};

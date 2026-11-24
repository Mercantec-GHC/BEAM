if ('serviceWorker' in navigator && window.isSecureContext) {
    navigator.serviceWorker.register('/service-worker.js', { updateViaCache: 'none' })
        .catch(error => console.error('BEAM offline setup failed', error));
}

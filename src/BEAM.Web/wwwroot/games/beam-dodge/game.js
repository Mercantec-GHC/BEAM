const canvas = document.querySelector('#game'), ctx = canvas.getContext('2d');
const label = document.querySelector('#score'), keys = new Set();
let x = 220, blocks = [], running = false, elapsed = 0, spawn = 0, previous = 0, best = 0;
try { best = Number(localStorage.getItem('beam-dodge-best')) || 0; } catch { /* Storage is optional. */ }
document.querySelector('#start').onclick = () => {
    x = 220; blocks = []; elapsed = spawn = 0; running = true; previous = performance.now();
};
window.addEventListener('keydown', event => {
    if (['ArrowLeft', 'ArrowRight'].includes(event.key)) { event.preventDefault(); keys.add(event.key); }
});
window.addEventListener('keyup', event => keys.delete(event.key));
window.addEventListener('blur', () => keys.clear());
function move(event) {
    const rect = canvas.getBoundingClientRect();
    const width = Math.min(rect.width, rect.height * 480 / 540);
    const left = rect.left + (rect.width - width) / 2;
    x = Math.max(0, Math.min(440, (event.clientX - left) * 480 / width - 20));
}
canvas.onpointerdown = event => { canvas.setPointerCapture(event.pointerId); move(event); };
canvas.onpointermove = event => { if (event.buttons) move(event); };
function frame(time) {
    const dt = Math.min((time - previous) / 1000, .05); previous = time;
    if (running && !document.hidden) {
        elapsed += dt; spawn += dt;
        x = Math.max(0, Math.min(440, x + ((keys.has('ArrowRight') ? 1 : 0) - (keys.has('ArrowLeft') ? 1 : 0)) * 340 * dt));
        if (spawn > .45) { blocks.push({ x: Math.random() * 440, y: -40 }); spawn = 0; }
        for (const block of blocks) {
            block.y += (180 + elapsed * 4) * dt;
            if (block.x < x + 40 && block.x + 40 > x && block.y < 500 && block.y + 40 > 460) running = false;
        }
        blocks = blocks.filter(block => block.y < 580);
        if (!running) {
            best = Math.max(best, Math.floor(elapsed));
            try { localStorage.setItem('beam-dodge-best', String(best)); } catch { /* Storage is optional. */ }
        }
        label.textContent = `${running ? 'Time' : 'Game over'}: ${Math.floor(elapsed)}s · Best: ${best}s`;
    }
    ctx.clearRect(0, 0, 480, 540); ctx.fillStyle = '#60a5fa'; ctx.fillRect(x, 460, 40, 40);
    ctx.fillStyle = '#fb7185'; for (const block of blocks) ctx.fillRect(block.x, block.y, 40, 40);
    requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

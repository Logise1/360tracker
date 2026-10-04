const SYNTH = 'https://synthesis-service.scratch.mit.edu/synth';

let unlocked = false;
let audioCtx = null;
let masterGain = null;
const queue = [];
let busy = false;

function cityName(city) {
    return String(city || 'the world').replace(/\s+/g, ' ').trim() || 'the world';
}

function ensureAudio() {
    if (audioCtx) return audioCtx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    audioCtx = new AC();
    masterGain = audioCtx.createGain();
    masterGain.gain.value = 4.2;
    masterGain.connect(audioCtx.destination);
    return audioCtx;
}

export function unlockVoice() {
    unlocked = true;
    const ctx = ensureAudio();
    if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
}

function synthUrl(text) {
    return `${SYNTH}?locale=en-US&gender=male&text=${encodeURIComponent(text)}`;
}

function playBuffer(decoded) {
    const ctx = ensureAudio();
    const src = ctx.createBufferSource();
    src.buffer = decoded;
        src.playbackRate.value = 1.0;
    src.connect(masterGain);
    return new Promise((resolve) => {
        src.onended = resolve;
        src.start();
        setTimeout(resolve, decoded.duration * 1000 / 0.96 + 80);
    });
}

function playElement(url) {
    return new Promise((resolve) => {
        const audio = new Audio(url);
        audio.preservesPitch = false;
        audio.mozPreservesPitch = false;
        audio.webkitPreservesPitch = false;
        audio.playbackRate = 1.0;
        audio.volume = 1;
        const done = () => resolve();
        audio.addEventListener('ended', done, { once: true });
        audio.addEventListener('error', done, { once: true });
        try {
            const ctx = ensureAudio();
            if (ctx && masterGain) {
                audio.crossOrigin = 'anonymous';
                const node = ctx.createMediaElementSource(audio);
                node.connect(masterGain);
            }
        } catch (e) {}
        const p = audio.play();
        if (p && typeof p.catch === 'function') p.catch(done);
        setTimeout(done, 12000);
    });
}

async function playText(text) {
    const url = synthUrl(text);
    const ctx = ensureAudio();
    if (ctx) {
        try {
            const res = await fetch(url);
            const raw = await res.arrayBuffer();
            const decoded = await ctx.decodeAudioData(raw.slice(0));
            await playBuffer(decoded);
            return;
        } catch (e) {}
    }
    await playElement(url);
}

async function drain() {
    if (busy) return;
    busy = true;
    while (queue.length) {
        const text = queue.shift();
        try {
            await playText(text);
        } catch (e) {}
        await new Promise((r) => setTimeout(r, 180));
    }
    busy = false;
}

export function speak(text) {
    const line = String(text || '').trim();
    if (!line) return;
    queue.push(line);
    drain();
}

export function speakLater(text, delayMs) {
    setTimeout(() => speak(text), delayMs);
}

export function playMerryChristmas(city) {
    speak(`Merry Christmas, ${cityName(city)}!`);
}

export function playArriving(city) {
    speak(`Arriving in ${cityName(city)}!`);
}

export function playDelivering() {
    speak('Delivering presents!');
}

export function playNextStop(city) {
    speak(`Next stop, ${cityName(city)}!`);
}

export function playTakeoff() {
    speak('Up, up, and away!');
}

export { cityName };

'use client';

// All sounds are synthesised with Web Audio — no assets to host.
let ctx: AudioContext | null = null;
function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  ctx ??= new Ctor();
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

function tone(freq: number, start: number, dur: number, type: OscillatorType = 'sine', gain = 0.2) {
  const a = audio();
  if (!a) return;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(0, a.currentTime + start);
  g.gain.linearRampToValueAtTime(gain, a.currentTime + start + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + start + dur);
  o.connect(g).connect(a.destination);
  o.start(a.currentTime + start);
  o.stop(a.currentTime + start + dur + 0.05);
}

/** Short burst of filtered noise: brake hiss, flap clacks. */
function noise(start: number, dur: number, gain = 0.15, freq = 2000, q = 0.8) {
  const a = audio();
  if (!a) return;
  const len = Math.max(1, Math.floor(a.sampleRate * dur));
  const buf = a.createBuffer(1, len, a.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  const src = a.createBufferSource();
  src.buffer = buf;
  const f = a.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = freq;
  f.Q.value = q;
  const g = a.createGain();
  g.gain.setValueAtTime(gain, a.currentTime + start);
  g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + start + dur);
  src.connect(f).connect(g).connect(a.destination);
  src.start(a.currentTime + start);
}

export const sounds = {
  /** Train pulling in: rising rumble, then a brake hiss. */
  trainArrive() {
    [70, 82, 95].forEach((f, i) => tone(f, i * 0.15, 0.6, 'sawtooth', 0.05));
    noise(0.9, 0.7, 0.12, 3500, 0.6);
  },
  /** Two-tone door chime, like a subway platform. */
  doorChime() {
    tone(659, 0, 0.5, 'sine', 0.2);
    tone(523, 0.32, 0.8, 'sine', 0.2);
  },
  /** Split-flap board clatter. */
  flaps(count = 14, every = 0.045) {
    for (let i = 0; i < count; i++) noise(i * every, 0.03, 0.09, 1800 + Math.random() * 1200, 3);
  },
  ding() {
    tone(880, 0, 0.15);
    tone(1320, 0.1, 0.25);
  },
  question() {
    tone(523, 0, 0.12, 'triangle');
    tone(659, 0.12, 0.12, 'triangle');
    tone(784, 0.24, 0.3, 'triangle');
  },
  airhorn() {
    for (let i = 0; i < 3; i++) {
      const s = i * 0.35;
      tone(466, s, 0.3, 'sawtooth', 0.25);
      tone(587, s, 0.3, 'sawtooth', 0.18);
      tone(698, s, 0.3, 'square', 0.08);
    }
  },
  sadTrombone() {
    [392, 370, 349, 330].forEach((f, i) => tone(f, i * 0.4, i === 3 ? 1 : 0.38, 'sawtooth', 0.15));
  },
  curse() {
    [220, 207, 196, 185].forEach((f, i) => tone(f, i * 0.18, 0.4, 'square', 0.1));
  },
  found() {
    [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.09, 0.25, 'triangle', 0.18));
    tone(1047, 0.4, 0.6, 'triangle', 0.15);
    tone(1319, 0.4, 0.6, 'sine', 0.1);
  },
  fanfare() {
    const notes: [number, number, number][] = [
      [523, 0, 0.18], [523, 0.2, 0.12], [523, 0.34, 0.12], [698, 0.5, 0.5],
      [880, 1.05, 0.18], [784, 1.25, 0.18], [880, 1.45, 0.18], [1047, 1.65, 0.9],
    ];
    notes.forEach(([f, t, d]) => {
      tone(f, t, d, 'sawtooth', 0.09);
      tone(f / 2, t, d, 'triangle', 0.08);
    });
  },
  alarm() {
    for (let i = 0; i < 6; i++) tone(i % 2 ? 660 : 880, i * 0.2, 0.18, 'square', 0.12);
  },
};

export function vibrate(pattern: number | number[]) {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(pattern);
}

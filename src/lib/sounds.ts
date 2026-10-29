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

export const sounds = {
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
  alarm() {
    for (let i = 0; i < 6; i++) tone(i % 2 ? 660 : 880, i * 0.2, 0.18, 'square', 0.12);
  },
};

export function vibrate(pattern: number | number[]) {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(pattern);
}

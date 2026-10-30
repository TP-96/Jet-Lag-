'use client';

import type { Profile } from './actions';

export const AVATARS = ['🧳', '🚆', '🚌', '🚇', '🗺️', '🧭', '🕵️', '🦊', '🐸', '🐙', '🦆', '🍋', '🥚', '🪨', '🎒', '🌭'];
export const COLORS = ['#f43f5e', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899'];

const KEY = 'hs-profile';

export function loadProfile(): Profile {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as Profile;
  } catch {}
  return { name: '', avatar: AVATARS[Math.floor(Math.random() * AVATARS.length)], color: COLORS[Math.floor(Math.random() * COLORS.length)] };
}

export function saveProfile(p: Profile) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {}
}

const RECENT = 'hs-recent';
export function recentGames(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT) ?? '[]') as string[];
  } catch {
    return [];
  }
}
export function rememberGame(code: string) {
  try {
    const list = [code, ...recentGames().filter((c) => c !== code)].slice(0, 5);
    localStorage.setItem(RECENT, JSON.stringify(list));
  } catch {}
}

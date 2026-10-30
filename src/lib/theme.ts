'use client';

import { useEffect, useState } from 'react';

export type ThemePref = 'system' | 'light' | 'dark';
export type Theme = 'light' | 'dark';

import { THEME_KEY as KEY } from './themeBoot';

const EVENT = 'hs-theme-change';

export function getThemePref(): ThemePref {
  try {
    const t = localStorage.getItem(KEY);
    if (t === 'light' || t === 'dark') return t;
  } catch {}
  return 'system';
}

export function setThemePref(pref: ThemePref) {
  try {
    if (pref === 'system') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, pref);
  } catch {}
  if (pref === 'system') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = pref;
  window.dispatchEvent(new Event(EVENT));
}

function resolve(pref: ThemePref): Theme {
  if (pref !== 'system') return pref;
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

/** The player's preference plus the theme actually showing. */
export function useTheme(): { pref: ThemePref; theme: Theme } {
  const [state, setState] = useState<{ pref: ThemePref; theme: Theme }>({ pref: 'system', theme: 'dark' });
  useEffect(() => {
    const update = () => {
      const pref = getThemePref();
      setState({ pref, theme: resolve(pref) });
    };
    update();
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    mq.addEventListener('change', update);
    window.addEventListener(EVENT, update);
    return () => {
      mq.removeEventListener('change', update);
      window.removeEventListener(EVENT, update);
    };
  }, []);
  return state;
}

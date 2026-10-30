'use client';

import { setThemePref, useTheme, type ThemePref } from '@/lib/theme';

const OPTIONS: [ThemePref, string][] = [
  ['system', '📱 Auto'],
  ['light', '☀️ Light'],
  ['dark', '🌙 Dark'],
];

export default function ThemeToggle() {
  const { pref } = useTheme();
  return (
    <div className="theme-toggle" role="radiogroup" aria-label="Theme">
      {OPTIONS.map(([id, label]) => (
        <button key={id} role="radio" aria-checked={pref === id} className={pref === id ? 'on' : ''} onClick={() => setThemePref(id)}>
          {label}
        </button>
      ))}
    </div>
  );
}

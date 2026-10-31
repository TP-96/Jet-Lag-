'use client';

import { useEffect, useState } from 'react';
import { MAX_HIDING_MINUTES, MIN_HIDING_MINUTES, formatMinutes } from '@/lib/game/config';

const PRESETS = [10, 15, 20, 30, 45, 60, 90, 120, 180, 240];

/**
 * A grouped-list row for picking the hiding time: the size's default, a common
 * preset, or any custom number of minutes.
 */
export default function HidingTimeRow({
  value,
  sizeDefault,
  onChange,
}: {
  value: number | null | undefined;
  sizeDefault: number;
  onChange: (minutes: number | null) => void;
}) {
  const custom = typeof value === 'number' && value > 0 ? value : null;
  const [mode, setMode] = useState<'default' | 'preset' | 'custom'>(custom == null ? 'default' : PRESETS.includes(custom) ? 'preset' : 'custom');
  const [draft, setDraft] = useState(String(custom ?? sizeDefault));

  // Follow changes made by the host on another device.
  useEffect(() => {
    if (custom == null) setMode((m) => (m === 'custom' ? m : 'default'));
    else if (PRESETS.includes(custom)) setMode((m) => (m === 'custom' ? m : 'preset'));
    else setMode('custom');
    setDraft(String(custom ?? sizeDefault));
  }, [custom, sizeDefault]);

  const selectValue = mode === 'default' ? 'default' : mode === 'custom' ? 'custom' : String(custom);

  const commit = () => {
    const n = Math.round(Number(draft));
    if (!Number.isFinite(n) || n < MIN_HIDING_MINUTES) {
      setDraft(String(custom ?? sizeDefault));
      return;
    }
    const clamped = Math.min(MAX_HIDING_MINUTES, n);
    setDraft(String(clamped));
    if (clamped !== custom) onChange(clamped);
  };

  return (
    <div className="item hiding-row">
      <label className="select-row">
        <span className="grow">
          <span>Hiding time</span>
          <span className="muted small">
            {custom == null ? `Default for this size: ${formatMinutes(sizeDefault)}` : `Custom: ${formatMinutes(custom)}`}
          </span>
        </span>
        <select
          value={selectValue}
          aria-label="Hiding time"
          onChange={(e) => {
            const v = e.target.value;
            if (v === 'default') {
              setMode('default');
              onChange(null);
            } else if (v === 'custom') {
              setMode('custom');
              setDraft(String(custom ?? sizeDefault));
            } else {
              setMode('preset');
              onChange(Number(v));
            }
          }}
        >
          <option value="default">Default ({formatMinutes(sizeDefault)})</option>
          {PRESETS.map((m) => (
            <option key={m} value={m}>
              {formatMinutes(m)}
            </option>
          ))}
          <option value="custom">Custom…</option>
        </select>
      </label>
      {mode === 'custom' && (
        <div className="custom-minutes">
          <input
            className="input"
            type="number"
            inputMode="numeric"
            min={MIN_HIDING_MINUTES}
            max={MAX_HIDING_MINUTES}
            step={1}
            value={draft}
            aria-label="Custom hiding time in minutes"
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()}
          />
          <span className="muted">minutes</span>
        </div>
      )}
    </div>
  );
}

'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { createGame, joinGame } from '@/lib/actions';
import { SIZES, type GameSize, type Units } from '@/lib/game/config';
import { AVATARS, COLORS, loadProfile, recentGames, rememberGame, saveProfile } from '@/lib/profile';
import { isConfigured } from '@/lib/supabase';
import type { Profile } from '@/lib/actions';
import ThemeToggle from '@/components/ThemeToggle';
import { CATEGORIES, CATEGORY_ORDER } from '@/lib/game/questions';

export default function Home() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile>({ name: '', avatar: AVATARS[0], color: COLORS[0] });
  const [mode, setMode] = useState<'join' | 'create'>('join');
  const [code, setCode] = useState('');
  const [gameName, setGameName] = useState('Hide + Seek');
  const [size, setSize] = useState<GameSize>('small');
  const [units, setUnits] = useState<Units>('metric');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [recent, setRecent] = useState<string[]>([]);

  useEffect(() => {
    setProfile(loadProfile());
    setRecent(recentGames());
    const c = new URLSearchParams(window.location.search).get('join');
    if (c) setCode(c.toUpperCase());
  }, []);

  const update = (p: Partial<Profile>) => {
    const next = { ...profile, ...p };
    setProfile(next);
    saveProfile(next);
  };

  async function go() {
    setErr(null);
    if (!profile.name.trim()) return setErr('Enter your name first');
    setBusy(true);
    try {
      const p = { ...profile, name: profile.name.trim().slice(0, 24) };
      let c = code.trim().toUpperCase();
      if (mode === 'create') c = await createGame({ name: gameName.trim() || 'Hide + Seek', size, settings: { units }, profile: p });
      else {
        if (c.length < 4) throw new Error('Enter the game code');
        await joinGame(c, p);
      }
      rememberGame(c);
      router.push(`/game?code=${c}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  return (
    <main className="home">
      <div className="home-top">
        <ThemeToggle />
      </div>
      <header className="station-sign">
        <div className="sign-body">
          <h1>
            Hide <span className="plus" aria-label="and">+</span>
            <br />
            Seek
          </h1>
          <p>One player hides somewhere on your city’s transit. Everyone else rides out to find them.</p>
        </div>
        <div className="route-stripe" aria-hidden="true">
          {CATEGORY_ORDER.map((id) => (
            <i key={id} style={{ background: CATEGORIES[id].color }} />
          ))}
        </div>
      </header>

      {!isConfigured && (
        <div className="card banner warn" style={{ display: 'block' }}>
          <b>Setup needed:</b> set <code>NEXT_PUBLIC_SUPABASE_URL</code> and <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> and run{' '}
          <code>supabase/schema.sql</code>. See the README.
        </div>
      )}

      <section className="card stack">
        <h2>You</h2>
        <label className="field">
          Name
          <input className="input" value={profile.name} maxLength={24} placeholder="e.g. Sam" onChange={(e) => update({ name: e.target.value })} />
        </label>
        <div className="muted small" style={{ fontWeight: 600, marginBottom: -4 }}>
          Map pin
        </div>
        <div className="avatar-grid">
          {AVATARS.map((a) => (
            <button key={a} className={profile.avatar === a ? 'on' : ''} onClick={() => update({ avatar: a })} aria-label={`avatar ${a}`}>
              {a}
            </button>
          ))}
        </div>
        <div className="swatches">
          {COLORS.map((c) => (
            <button key={c} className={profile.color === c ? 'on' : ''} style={{ background: c }} onClick={() => update({ color: c })} aria-label={`color ${c}`} />
          ))}
        </div>
      </section>

      <section className="card stack">
        <div className="seg" role="tablist">
          <button role="tab" aria-selected={mode === 'join'} className={mode === 'join' ? 'on' : ''} onClick={() => setMode('join')}>
            Join a game
          </button>
          <button role="tab" aria-selected={mode === 'create'} className={mode === 'create' ? 'on' : ''} onClick={() => setMode('create')}>
            Start a new game
          </button>
        </div>
        {mode === 'join' ? (
          <>
            <input
              className="input code-input"
              placeholder="Code"
              aria-label="Game code"
              value={code}
              maxLength={6}
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
              onKeyDown={(e) => e.key === 'Enter' && go()}
            />
            {recent.length > 0 && (
              <div className="row wrap small muted">
                Recent:
                {recent.map((c) => (
                  <button key={c} className="btn small" onClick={() => setCode(c)}>
                    {c}
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            <label className="field">
              Game name
              <input className="input" value={gameName} maxLength={40} onChange={(e) => setGameName(e.target.value)} />
            </label>
            <label className="field">
              Game size
              <select className="input" value={size} onChange={(e) => setSize(e.target.value as GameSize)}>
                {(Object.keys(SIZES) as GameSize[]).map((s) => (
                  <option key={s} value={s}>
                    {SIZES[s].label}
                  </option>
                ))}
              </select>
              <span className="small">{SIZES[size].blurb}</span>
            </label>
            <div className="seg">
              <button className={units === 'metric' ? 'on' : ''} onClick={() => setUnits('metric')}>
                Kilometres
              </button>
              <button className={units === 'imperial' ? 'on' : ''} onClick={() => setUnits('imperial')}>
                Miles
              </button>
            </div>
          </>
        )}
        {err && <div className="banner danger" style={{ borderRadius: 10 }}>{err}</div>}
        <button className="btn primary block" disabled={busy || !isConfigured} onClick={go}>
          {busy ? 'Connecting…' : mode === 'join' ? 'Join game' : 'Start game'}
        </button>
      </section>

      <p className="home-foot">
        <Link href="/rules">How to play, and every card in the deck</Link>
        <br />
        Fan-made game inspired by Jet Lag: The Game. Not affiliated with Wendover Productions.
      </p>
    </main>
  );
}

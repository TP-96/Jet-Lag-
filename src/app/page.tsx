'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { createGame, joinGame } from '@/lib/actions';
import { useAccount } from '@/lib/account';
import { SIZES, type GameSize, type Units } from '@/lib/game/config';
import { CATEGORIES, CATEGORY_ORDER } from '@/lib/game/questions';
import { AVATARS, COLORS, loadProfile, saveProfile } from '@/lib/profile';
import {
  isConfigured,
  myGames,
  profileFromUser,
  saveProfileRemote,
  sendPasswordReset,
  setNewPassword,
  signInWithEmail,
  signOut,
  signUpWithEmail,
  type MyGame,
} from '@/lib/supabase';
import type { Profile } from '@/lib/actions';
import ThemeToggle from '@/components/ThemeToggle';

const STATUS_LABEL: Record<string, string> = {
  lobby: 'In the lobby',
  hiding: 'Hiding now',
  seeking: 'Seeking now',
  endgame: 'Endgame',
  round_over: 'Between rounds',
  finished: 'Finished',
};

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function Sign({ compact, children }: { compact?: boolean; children?: React.ReactNode }) {
  return (
    <header className={`station-sign ${compact ? 'compact' : ''}`}>
      <div className="sign-body">
        <h1>
          Hide <span className="plus" aria-label="and">+</span>
          {!compact && <br />} Seek
        </h1>
        {children}
      </div>
      <div className="route-stripe" aria-hidden="true">
        {CATEGORY_ORDER.map((id) => (
          <i key={id} style={{ background: CATEGORIES[id].color }} />
        ))}
      </div>
    </header>
  );
}

function AuthPanel({ joinCode }: { joinCode: string }) {
  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setNote(null);
    setBusy(true);
    try {
      if (mode === 'signin') await signInWithEmail(email, password);
      else if (mode === 'signup') {
        if (!name.trim()) throw new Error('Add the name other players will see.');
        const base = loadProfile();
        const profile: Profile = { ...base, name: name.trim().slice(0, 24) };
        saveProfile(profile);
        const user = await signUpWithEmail(email, password, profile);
        if (!user) setNote(`Almost there. We sent a confirmation link to ${email.trim()}. Open it, then sign in here.`);
      } else {
        await sendPasswordReset(email);
        setNote(`If ${email.trim()} has an account, a reset link is on its way.`);
      }
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : String(e2));
    } finally {
      setBusy(false);
    }
  }

  const title = mode === 'signin' ? 'Sign in' : mode === 'signup' ? 'Create your account' : 'Reset your password';
  return (
    <form className="auth" onSubmit={submit} noValidate>
      <h2>{title}</h2>
      {joinCode && mode !== 'forgot' && <p className="lede">Sign in to join game {joinCode}.</p>}
      {mode === 'signup' && (
        <p className="lede">Your email is your login. Use it on any phone to get back into your games.</p>
      )}
      <div className="group">
        {mode === 'signup' && (
          <label className="item field-row">
            <span>Name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={24} autoComplete="nickname" placeholder="What friends call you" />
          </label>
        )}
        <label className="item field-row">
          <span>Email</span>
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
        </label>
        {mode !== 'forgot' && (
          <label className="item field-row">
            <span>Password</span>
            <input
              type="password"
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === 'signup' ? 'At least 6 characters' : ''}
            />
          </label>
        )}
      </div>
      {err && <p className="form-error" role="alert">{err}</p>}
      {note && <p className="form-note" role="status">{note}</p>}
      <button className="btn primary block" disabled={busy || !email.trim() || (mode !== 'forgot' && password.length < 6) || !isConfigured}>
        {busy ? 'One moment…' : mode === 'signin' ? 'Sign in' : mode === 'signup' ? 'Create account' : 'Send reset link'}
      </button>
      <div className="auth-switch">
        {mode === 'signin' ? (
          <>
            <button type="button" className="link" onClick={() => setMode('signup')}>
              New here? Create an account
            </button>
            <button type="button" className="link muted" onClick={() => setMode('forgot')}>
              Forgot password
            </button>
          </>
        ) : (
          <button type="button" className="link" onClick={() => setMode('signin')}>
            I already have an account
          </button>
        )}
      </div>
    </form>
  );
}

function NewPasswordPanel({ onDone }: { onDone: () => void }) {
  const [pw, setPw] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="auth"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setErr(null);
        try {
          await setNewPassword(pw);
          onDone();
        } catch (e2) {
          setErr((e2 as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2>Choose a new password</h2>
      <div className="group">
        <label className="item field-row">
          <span>Password</span>
          <input type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="At least 6 characters" />
        </label>
      </div>
      {err && <p className="form-error">{err}</p>}
      <button className="btn primary block" disabled={busy || pw.length < 6}>
        Save password
      </button>
    </form>
  );
}

export default function Home() {
  const router = useRouter();
  const { user, loading, recovering, doneRecovering } = useAccount();
  const [profile, setProfile] = useState<Profile>({ name: '', avatar: AVATARS[0], color: COLORS[0] });
  const [code, setCode] = useState('');
  const [gameName, setGameName] = useState('');
  const [size, setSize] = useState<GameSize>('small');
  const [units, setUnits] = useState<Units>('metric');
  const [busy, setBusy] = useState<'join' | 'create' | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [games, setGames] = useState<MyGame[]>([]);
  const [editingProfile, setEditingProfile] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const c = new URLSearchParams(window.location.search).get('join');
    if (c) setCode(c.toUpperCase());
  }, []);

  // Load the account's profile (and cache it on this device for the game screen).
  useEffect(() => {
    if (!user) return;
    const remote = profileFromUser(user);
    const p = remote ?? loadProfile();
    setProfile(p);
    saveProfile(p);
    if (!remote && p.name) saveProfileRemote(p).catch(() => {});
    if (!p.name) setEditingProfile(true);
    myGames(user.id).then(setGames);
  }, [user]);

  const update = (p: Partial<Profile>) => {
    const next = { ...profile, ...p };
    setProfile(next);
    saveProfile(next);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveProfileRemote(next).catch(() => {}), 600);
  };

  async function go(mode: 'join' | 'create') {
    setErr(null);
    if (!profile.name.trim()) {
      setEditingProfile(true);
      return setErr('Add your name first. It’s what other players see.');
    }
    setBusy(mode);
    try {
      const p = { ...profile, name: profile.name.trim().slice(0, 24) };
      let c = code.trim().toUpperCase();
      if (mode === 'create') c = await createGame({ name: gameName.trim() || `${p.name}’s game`, size, settings: { units }, profile: p });
      else {
        if (c.length < 4) throw new Error('Type the game code your friend shared.');
        await joinGame(c, p);
      }
      router.push(`/game?code=${c}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setBusy(null);
    }
  }

  if (!isConfigured) {
    return (
      <main className="home">
        <Sign />
        <div className="content">
          <p className="form-error">
            This copy of the app isn’t connected to a database yet. Set <code>NEXT_PUBLIC_SUPABASE_URL</code> and{' '}
            <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>, then run <code>supabase/schema.sql</code>.
          </p>
        </div>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="home">
        <Sign />
      </main>
    );
  }

  if (recovering) {
    return (
      <main className="home">
        <Sign compact />
        <div className="content">
          <NewPasswordPanel onDone={doneRecovering} />
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="home">
        <Sign>
          <p>One player hides somewhere on your city’s transit. Everyone else rides out to find them.</p>
        </Sign>
        <div className="content">
          <AuthPanel joinCode={code} />
          <p className="home-foot">
            <Link href="/rules">How to play</Link>
            <br />
            Fan-made, inspired by Jet Lag: The Game. Not affiliated with Wendover Productions.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="home">
      <Sign compact>
        <div className="account-line">
          <span className="who">{user.email}</span>
          <button className="link on-ink" onClick={() => signOut()}>
            Sign out
          </button>
        </div>
      </Sign>

      <div className="content">
        <section aria-labelledby="you">
          <h2 id="you" className="group-title">
            You
          </h2>
          <div className="group">
            <button className="item player-summary" onClick={() => setEditingProfile((v) => !v)} aria-expanded={editingProfile}>
              <span className="pin" style={{ background: profile.color }}>
                {profile.avatar}
              </span>
              <span className="grow">
                <b>{profile.name || 'Add your name'}</b>
                <span className="muted small">How you appear on the map</span>
              </span>
              <span className="chev" aria-hidden>
                {editingProfile ? '−' : '+'}
              </span>
            </button>
            {editingProfile && (
              <div className="item stack" style={{ paddingTop: 12, paddingBottom: 14 }}>
                <label className="field">
                  Name
                  <input className="input" value={profile.name} maxLength={24} placeholder="What friends call you" onChange={(e) => update({ name: e.target.value })} />
                </label>
                <div className="field">
                  Map pin
                  <div className="avatar-grid">
                    {AVATARS.map((a) => (
                      <button key={a} className={profile.avatar === a ? 'on' : ''} onClick={() => update({ avatar: a })} aria-label={`Pin ${a}`} aria-pressed={profile.avatar === a}>
                        {a}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="field">
                  Colour
                  <div className="swatches">
                    {COLORS.map((c) => (
                      <button key={c} className={profile.color === c ? 'on' : ''} style={{ background: c }} onClick={() => update({ color: c })} aria-label={`Colour ${c}`} aria-pressed={profile.color === c} />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        <section aria-labelledby="join">
          <h2 id="join" className="group-title">
            Join a game
          </h2>
          <div className="join-row">
            <input
              className="input code-input"
              placeholder="Code"
              aria-label="Game code"
              value={code}
              maxLength={6}
              autoCapitalize="characters"
              autoComplete="off"
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
              onKeyDown={(e) => e.key === 'Enter' && go('join')}
            />
            <button className="btn primary" disabled={!!busy || code.length < 4} onClick={() => go('join')}>
              {busy === 'join' ? 'Joining…' : 'Join'}
            </button>
          </div>
        </section>

        {err && (
          <p className="form-error" role="alert">
            {err}
          </p>
        )}

        <section aria-labelledby="new">
          <h2 id="new" className="group-title">
            Start a new game
          </h2>
          <div className="group">
            <label className="item field-row">
              <span>Name</span>
              <input value={gameName} maxLength={40} placeholder={`${profile.name || 'My'}’s game`} onChange={(e) => setGameName(e.target.value)} />
            </label>
            {(Object.keys(SIZES) as GameSize[]).map((s) => (
              <label key={s} className={`item radio-row ${size === s ? 'on' : ''}`}>
                <input type="radio" name="size" value={s} checked={size === s} onChange={() => setSize(s)} />
                <span className="grow">
                  <b>{SIZES[s].label.split(' — ')[0]}</b>
                  <span className="muted small">{cap(SIZES[s].label.split(' — ')[1] ?? SIZES[s].blurb)}</span>
                </span>
                <span className="muted small">{SIZES[s].hidingMinutes >= 120 ? `${SIZES[s].hidingMinutes / 60} h` : `${SIZES[s].hidingMinutes} min`} to hide</span>
              </label>
            ))}
            <div className="item row spread">
              <span>Distances in</span>
              <div className="seg small-seg">
                <button className={units === 'metric' ? 'on' : ''} onClick={() => setUnits('metric')} aria-pressed={units === 'metric'}>
                  km
                </button>
                <button className={units === 'imperial' ? 'on' : ''} onClick={() => setUnits('imperial')} aria-pressed={units === 'imperial'}>
                  miles
                </button>
              </div>
            </div>
          </div>
          <button className="btn primary block" style={{ marginTop: 12 }} disabled={!!busy} onClick={() => go('create')}>
            {busy === 'create' ? 'Starting…' : 'Start game'}
          </button>
        </section>

        {games.length > 0 && (
          <section aria-labelledby="mine">
            <h2 id="mine" className="group-title">
              Your games
            </h2>
            <div className="group">
              {games.map((g) => (
                <Link key={g.code} href={`/game?code=${g.code}`} className="item game-row">
                  <span className="code-chip">{g.code}</span>
                  <span className="grow">
                    <b>{g.name}</b>
                    <span className="muted small">{STATUS_LABEL[g.status] ?? g.status}</span>
                  </span>
                  <span className="chev" aria-hidden>
                    ›
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}

        <div className="home-foot">
          <ThemeToggle />
          <p>
            <Link href="/rules">How to play</Link>
            <br />
            Fan-made, inspired by Jet Lag: The Game. Not affiliated with Wendover Productions.
          </p>
        </div>
      </div>
    </main>
  );
}

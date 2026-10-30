'use client';

import { useEffect, useMemo, useState } from 'react';
import { formatDuration } from '@/lib/game/config';
import { CATEGORIES, CATEGORY_ORDER } from '@/lib/game/questions';
import { standings } from '@/lib/game/scoring';
import { sounds, vibrate } from '@/lib/sounds';
import { useGameCtx } from './GameContext';

export type CelebrationKind = 'found' | 'winner';

const FLAP_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789:+';
const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Split-flap text, like an old departures board: each letter spins through
 * random characters and settles left to right.
 */
function SplitFlap({ text, delay = 0, perChar = 70, spin = 600, className = '' }: { text: string; delay?: number; perChar?: number; spin?: number; className?: string }) {
  const target = text.toUpperCase();
  const [shown, setShown] = useState(() => (reducedMotion() ? target : target.replace(/[^ ]/g, ' ')));

  useEffect(() => {
    if (reducedMotion()) {
      setShown(target);
      return;
    }
    const t0 = performance.now() + delay;
    let raf = 0;
    let last = 0;
    const step = (t: number) => {
      if (t - last > 45) {
        last = t;
        let done = true;
        const next = [...target]
          .map((ch, i) => {
            if (ch === ' ') return ' ';
            const settle = t0 + spin + i * perChar;
            if (t < t0) {
              done = false;
              return ' ';
            }
            if (t >= settle) return ch;
            done = false;
            return FLAP_CHARS[Math.floor(Math.random() * FLAP_CHARS.length)];
          })
          .join('');
        setShown(next);
        if (done) return;
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, delay, perChar, spin]);

  return (
    <span className={`flap ${className}`} aria-label={text}>
      {[...shown].map((ch, i) => (
        <span key={i} className={`flap-cell ${target[i] === ' ' ? 'gap' : ''}`} aria-hidden>
          {ch}
        </span>
      ))}
    </span>
  );
}

/** Confetti made of little punched transit tickets in the line colours. */
function TicketConfetti({ count = 46, loop = false, delay = 0 }: { count?: number; loop?: boolean; delay?: number }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        i,
        left: Math.random() * 100,
        dur: 2.6 + Math.random() * 2.6,
        delay: delay + Math.random() * (loop ? 5 : 0.9),
        drift: (Math.random() - 0.5) * 160,
        spin: (Math.random() > 0.5 ? 1 : -1) * (360 + Math.random() * 720),
        color: CATEGORIES[CATEGORY_ORDER[i % CATEGORY_ORDER.length]].color,
        scale: 0.7 + Math.random() * 0.6,
      })),
    [count, loop, delay],
  );
  return (
    <div className="tickets" aria-hidden>
      {pieces.map((p) => (
        <i
          key={p.i}
          style={
            {
              left: `${p.left}%`,
              background: p.color,
              animationDuration: `${p.dur}s`,
              animationDelay: `${p.delay}s`,
              animationIterationCount: loop ? 'infinite' : 1,
              '--drift': `${p.drift}px`,
              '--spin': `${p.spin}deg`,
              '--s': p.scale,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}

function FoundScene() {
  const { game, player, rounds } = useGameCtx();
  const hider = player(game.hider_id);
  const seekMs = game.found_at && game.seek_started_at ? new Date(game.found_at).getTime() - new Date(game.seek_started_at).getTime() : 0;
  const result = rounds.find((r) => r.round === game.round);
  const [stage, setStage] = useState(0);

  // 0 train arriving → 1 doors open → 2 board flips → 3 bonus
  useEffect(() => {
    const quick = reducedMotion();
    sounds.trainArrive();
    const timers = [
      setTimeout(() => (setStage(1), sounds.doorChime(), vibrate([60, 40, 60])), quick ? 0 : 1500),
      setTimeout(() => (setStage(2), sounds.flaps(16), sounds.found()), quick ? 0 : 2300),
      setTimeout(() => (setStage(3), sounds.flaps(10)), quick ? 0 : 3700),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div className="found-scene">
      <div className="board found-board" aria-live="polite">
        {/* The board starts blank and clacks into place once the doors open. */}
        <div className="board-row">
          <SplitFlap text="Found" delay={reducedMotion() ? 0 : 2300} className="flap-xl" />
        </div>
        <div className="board-row small">
          <SplitFlap text={(hider?.name ?? 'Hider').slice(0, 14)} delay={reducedMotion() ? 0 : 2650} perChar={55} spin={450} />
        </div>
      </div>

      <div className={`platform ${stage >= 1 ? 'arrived' : ''}`}>
        <div className="train" style={{ '--livery': hider?.color ?? '#f6be00' } as React.CSSProperties}>
          <div className="car end" />
          <div className="car mid">
            <div className={`doorway ${stage >= 1 ? 'open' : ''}`}>
              <span className="rider" style={{ background: hider?.color }}>
                {hider?.avatar ?? '?'}
              </span>
              <i className="door l" />
              <i className="door r" />
            </div>
          </div>
          <div className="car end front" />
        </div>
        <div className="rails" />
      </div>

      <div className="found-time">
        <span className={`found-label ${stage >= 2 ? 'in' : ''}`}>Hid for</span>
        <SplitFlap text={formatDuration(seekMs)} delay={reducedMotion() ? 0 : 3000} perChar={90} spin={500} className="flap-lg" />
        {stage >= 3 && result && result.bonus_ms > 0 && (
          <div className="found-bonus">
            Plus {Math.round(result.bonus_ms / 60000)} min of bonus cards: <b>{formatDuration(result.total_ms)}</b>
          </div>
        )}
        {stage >= 3 && !result && <div className="found-bonus muted-on-ink">Adding up the hider’s bonus cards…</div>}
      </div>
      {stage >= 2 && <TicketConfetti count={40} />}
    </div>
  );
}

function WinnerScene() {
  const { players, rounds, player } = useGameCtx();
  const ranked = standings(
    players.map((p) => p.user_id),
    rounds,
  ).filter((s) => s.best >= 0);
  const champ = ranked[0] ? player(ranked[0].userId) : undefined;
  const rowsDone = 900 + Math.min(ranked.length, 6) * 450;

  useEffect(() => {
    sounds.flaps(22);
    const t1 = setTimeout(() => sounds.flaps(18), 900);
    const t2 = setTimeout(() => (sounds.fanfare(), vibrate([200, 100, 200, 100, 600])), rowsDone + 400);
    return () => (clearTimeout(t1), clearTimeout(t2));
  }, [rowsDone]);

  return (
    <div className="winner-scene">
      <div className="board departures">
        <div className="board-head">
          <SplitFlap text="End of the line" perChar={45} spin={400} />
        </div>
        <ol className="board-rows">
          {ranked.slice(0, 6).map((s, i) => {
            const p = player(s.userId);
            return (
              <li key={s.userId} className={i === 0 ? 'lead' : ''} style={{ animationDelay: `${0.9 + i * 0.45}s` }}>
                <span className="slot">{i + 1}</span>
                <span className="who-pin" style={{ background: p?.color }}>
                  {p?.avatar}
                </span>
                <SplitFlap text={(p?.name ?? '').slice(0, 12)} delay={900 + i * 450} perChar={45} spin={350} />
                <SplitFlap text={formatDuration(s.best)} delay={1100 + i * 450} perChar={60} spin={300} className="right" />
              </li>
            );
          })}
          {ranked.length === 0 && (
            <li style={{ animationDelay: '0.9s' }}>
              <SplitFlap text="No rounds played" delay={900} />
            </li>
          )}
        </ol>
      </div>
      {champ && (
        <div className="champ" style={{ animationDelay: `${rowsDone / 1000 + 0.3}s` }}>
          <span className="champ-pin" style={{ background: champ.color }}>
            {champ.avatar}
          </span>
          <div className="champ-name">{champ.name} wins</div>
          <div className="champ-sub">Longest time hidden</div>
        </div>
      )}
      <TicketConfetti count={60} loop delay={rowsDone / 1000 + 0.2} />
    </div>
  );
}

export default function Celebration({ kind, onClose }: { kind: CelebrationKind; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, kind === 'found' ? 12000 : 22000);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => (clearTimeout(t), window.removeEventListener('keydown', onKey));
  }, [kind, onClose]);

  return (
    <div className={`celebration cel-${kind}`} onClick={onClose} role="dialog" aria-modal="true" aria-label={kind === 'found' ? 'Hider found' : 'Final standings'}>
      {kind === 'found' ? <FoundScene /> : <WinnerScene />}
      <div className="cel-hint">Tap anywhere to close</div>
    </div>
  );
}

'use client';

import { useEffect, useMemo, useState } from 'react';
import { formatDuration } from '@/lib/game/config';
import { standings } from '@/lib/game/scoring';
import { sounds, vibrate } from '@/lib/sounds';
import { useGameCtx } from './GameContext';

export type CelebrationKind = 'found' | 'winner';

/** Eased count-up from 0 to `target` over `ms`, starting after `delay`. */
function useCountUp(target: number, ms = 2200, delay = 600): number {
  const [value, setValue] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now() + delay;
    const step = (t: number) => {
      const p = Math.min(1, Math.max(0, (t - start) / ms));
      setValue(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, ms, delay]);
  return value;
}

function Confetti({ count = 70, loop = false }: { count?: number; loop?: boolean }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        i,
        left: Math.random() * 100,
        dur: 2.2 + Math.random() * 2.4,
        delay: Math.random() * (loop ? 4 : 0.8),
        rot: Math.random() * 360,
        color: ['#ffd400', '#ff4d5e', '#2fd47a', '#3d8bff', '#a855f7', '#f97316'][i % 6],
        w: 6 + Math.random() * 6,
      })),
    [count, loop],
  );
  return (
    <div className="cel-confetti" aria-hidden>
      {pieces.map((p) => (
        <i
          key={p.i}
          style={{
            left: `${p.left}%`,
            width: p.w,
            height: p.w * 1.6,
            background: p.color,
            animationDuration: `${p.dur}s`,
            animationDelay: `${p.delay}s`,
            animationIterationCount: loop ? 'infinite' : 1,
            transform: `rotate(${p.rot}deg)`,
          }}
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
  const shown = useCountUp(seekMs);
  const done = shown >= seekMs * 0.999;
  return (
    <>
      <div className="cel-rays" aria-hidden />
      <div className="cel-stage">
        <div className="cel-target">
          <div className="cel-reticle" aria-hidden />
          <div className="cel-avatar" style={{ background: hider?.color }}>
            {hider?.avatar ?? '🫣'}
          </div>
        </div>
        <h1 className="cel-slam">FOUND!</h1>
        <div className="cel-sub">{hider?.name ?? 'The hider'} hid for</div>
        <div className="cel-time">{formatDuration(shown)}</div>
        {done && result && result.bonus_ms > 0 && (
          <div className="cel-pop">
            + {Math.round(result.bonus_ms / 60000)} min time bonus = <b>{formatDuration(result.total_ms)}</b>
          </div>
        )}
        {done && !result && <div className="cel-pop muted">Adding up the hider’s time bonus cards…</div>}
      </div>
      <Confetti count={60} />
    </>
  );
}

function WinnerScene() {
  const { players, rounds, player } = useGameCtx();
  const ranked = standings(
    players.map((p) => p.user_id),
    rounds,
  ).filter((s) => s.best >= 0);
  const [first, second, third] = ranked;
  const slot = (s: (typeof ranked)[number] | undefined, place: 1 | 2 | 3) => {
    if (!s) return <div className={`podium-col p${place} empty`} />;
    const p = player(s.userId);
    return (
      <div className={`podium-col p${place}`}>
        <div className="podium-who">
          {place === 1 && <div className="cel-crown">👑</div>}
          <div className="cel-avatar small" style={{ background: p?.color }}>
            {p?.avatar}
          </div>
          <div className="podium-name">{p?.name}</div>
          <div className="podium-time">{formatDuration(s.best)}</div>
        </div>
        <div className="podium-block">{place}</div>
      </div>
    );
  };
  return (
    <>
      <div className="cel-spot" aria-hidden />
      <div className="cel-stage">
        <h1 className="cel-champ">{first ? 'CHAMPION' : 'GAME OVER'}</h1>
        {first && <div className="cel-sub cel-name-in">{player(first.userId)?.name}</div>}
        <div className="podium">
          {slot(second, 2)}
          {slot(first, 1)}
          {slot(third, 3)}
        </div>
        {ranked.length > 3 && (
          <ol className="cel-rest" start={4}>
            {ranked.slice(3).map((s) => (
              <li key={s.userId}>
                {player(s.userId)?.avatar} {player(s.userId)?.name} · {formatDuration(s.best)}
              </li>
            ))}
          </ol>
        )}
      </div>
      <Confetti count={90} loop />
    </>
  );
}

export default function Celebration({ kind, onClose }: { kind: CelebrationKind; onClose: () => void }) {
  useEffect(() => {
    if (kind === 'found') {
      sounds.found();
      vibrate([100, 50, 100, 50, 400]);
    } else {
      sounds.fanfare();
      vibrate([200, 100, 200, 100, 600]);
    }
    const t = setTimeout(onClose, kind === 'found' ? 9000 : 20000);
    return () => clearTimeout(t);
  }, [kind, onClose]);

  return (
    <div className={`celebration cel-${kind}`} onClick={onClose} role="dialog" aria-label={kind === 'found' ? 'Hider found' : 'Winner'}>
      {kind === 'found' ? <FoundScene /> : <WinnerScene />}
      <div className="cel-hint">Tap to continue</div>
    </div>
  );
}

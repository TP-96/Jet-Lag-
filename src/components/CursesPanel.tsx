'use client';

import { clearEffect } from '@/lib/actions';
import { formatDuration } from '@/lib/game/config';
import { cardDef } from '@/lib/game/deck';
import { CardView } from './CardView';
import { useGameCtx, useNow } from './GameContext';

export default function CursesPanel() {
  const { game, effects, toast } = useGameCtx();
  const now = useNow(1000);
  const roundFx = effects.filter((e) => e.round === game.round);
  const active = roundFx.filter((e) => !e.cleared_at && (!e.ends_at || new Date(e.ends_at).getTime() > now));
  const past = roundFx.filter((e) => !active.includes(e));

  return (
    <div className="stack">
      <h3>Active curses</h3>
      {active.length === 0 && <div className="card muted">No curses on you right now.</div>}
      {active.map((e) => {
        const d = cardDef(e.card_id);
        return (
          <div key={e.id} className="stack">
            <CardView card={e.card_id} size={game.size} big />
            <div className="row" style={{ justifyContent: 'center' }}>
              {e.ends_at && <span className="tag">{formatDuration(new Date(e.ends_at).getTime() - now)} left</span>}
              {d.kind === 'curse' && !d.durationMin && (
                <button
                  className="btn small ok"
                  onClick={() => confirm(`Mark ${d.name} as completed / cleared?`) && clearEffect(e.id).catch((err) => toast(err.message))}
                >
                  We’ve done it
                </button>
              )}
            </div>
          </div>
        );
      })}
      {past.length > 0 && (
        <>
          <h3>Earlier this round</h3>
          <div className="qlist">
            {past.map((e) => (
              <div key={e.id} className="qitem small" style={{ borderLeftColor: '#c0264f' }}>
                {cardDef(e.card_id).name} · {new Date(e.cast_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

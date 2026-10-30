'use client';

import { useState } from 'react';
import { discardCards, resolveDraw } from '@/lib/game/deck';
import { CardView } from './CardView';
import { useGameCtx } from './GameContext';

export function DrawModal() {
  const { hiderState, game, mutateHider, toast } = useGameCtx();
  const [picked, setPicked] = useState<string[]>([]);
  const pending = hiderState?.state.pending;
  if (!pending) return null;
  const toggle = (c: string) =>
    setPicked((p) => (p.includes(c) ? p.filter((x) => x !== c) : p.length >= pending.keep ? [...p.slice(1), c] : [...p, c]));
  const confirm = async () => {
    try {
      await mutateHider((s) => resolveDraw(s, picked));
      setPicked([]);
    } catch (e) {
      toast((e as Error).message);
    }
  };
  return (
    <div className="menu">
      <div className="sheet">
        <h3>
          🃏 Draw {pending.cards.length}, keep {pending.keep}
        </h3>
        <p className="small muted">{pending.reason}</p>
        <div className="hand">
          {pending.cards.map((c) => (
            <CardView key={c} card={c} size={game.size} selected={picked.includes(c)} onClick={() => toggle(c)} />
          ))}
        </div>
        <button className="btn primary block" disabled={picked.length !== pending.keep} onClick={confirm}>
          Keep {picked.length}/{pending.keep}
        </button>
      </div>
    </div>
  );
}

export function OverLimitModal() {
  const { hiderState, game, mutateHider } = useGameCtx();
  const [picked, setPicked] = useState<string[]>([]);
  if (!hiderState) return null;
  const { hand, handLimit } = hiderState.state;
  const need = hand.length - handLimit;
  const toggle = (c: string) => setPicked((p) => (p.includes(c) ? p.filter((x) => x !== c) : [...p, c].slice(-need)));
  return (
    <div className="menu">
      <div className="sheet">
        <h3>✋ Hand limit is {handLimit}</h3>
        <p className="small muted">Discard {need} card{need > 1 ? 's' : ''}.</p>
        <div className="hand">
          {hand.map((c) => (
            <CardView key={c} card={c} size={game.size} selected={picked.includes(c)} onClick={() => toggle(c)} />
          ))}
        </div>
        <button
          className="btn danger block"
          disabled={picked.length !== need}
          onClick={async () => {
            await mutateHider((s) => discardCards(s, picked));
            setPicked([]);
          }}
        >
          Discard {picked.length}/{need}
        </button>
      </div>
    </div>
  );
}

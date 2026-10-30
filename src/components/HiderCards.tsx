'use client';

import { useState } from 'react';
import { castEffect, sendMessage, setMoveUntil, systemMessage } from '@/lib/actions';
import { SIZES } from '@/lib/game/config';
import { beginDraw, cardDef, discardCards, duplicateCard, handTimeBonus, playCard } from '@/lib/game/deck';
import { sounds } from '@/lib/sounds';
import { CardView } from './CardView';
import { useGameCtx } from './GameContext';

type Pick = { card: string; need: number; title: string; exclude?: string; run: (picked: string[]) => Promise<void> };

export default function HiderCards() {
  const { game, hiderState, mutateHider, toast } = useGameCtx();
  const [open, setOpen] = useState<string | null>(null);
  const [pick, setPick] = useState<Pick | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  if (!hiderState) return <p className="muted">Shuffling your deck…</p>;
  const s = hiderState.state;
  const inPlay = ['hiding', 'seeking', 'endgame'].includes(game.status);
  const bonus = handTimeBonus(s.hand, game.size);

  async function guard(fn: () => Promise<void>) {
    setBusy(true);
    try {
      await fn();
      setOpen(null);
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function play(card: string) {
    const d = cardDef(card);
    if (d.kind === 'curse') {
      if (!confirm(`Cast ${d.name}?\n\nCasting cost: ${d.cost}\n\nMake sure you've paid it (discard cards from your hand if the cost says so).`)) return;
      await guard(async () => {
        await mutateHider((st) => {
          const after = playCard(st, card);
          return d.id === 'curse-overflowing-chalice' ? { ...after, chaliceRemaining: after.chaliceRemaining + 3 } : after;
        });
        await castEffect(game, d.id, d.durationMin ? new Date(Date.now() + d.durationMin * 60_000) : null);
        await sendMessage({ game_id: game.id, kind: 'card', body: d.name, meta: { card_id: d.id } });
        sounds.curse();
      });
      return;
    }
    if (d.kind !== 'powerup') return;
    const others = s.hand.filter((c) => c !== card);
    switch (d.powerup) {
      case 'veto':
      case 'randomize':
        toast('Play this from the Answer tab when a question comes in.');
        return;
      case 'discard1draw2':
      case 'discard2draw3': {
        const n = d.powerup === 'discard1draw2' ? 1 : 2;
        if (others.length < n) return toast(`You need ${n} other card(s) to discard.`);
        setPicked([]);
        setPick({
          card,
          need: n,
          title: `Discard ${n}, then draw ${n + 1}`,
          exclude: card,
          run: async (cards) => {
            await mutateHider((st) => beginDraw(discardCards(playCard(st, card), cards), n + 1, n + 1, d.name));
            await systemMessage(game.id, `The hider played ${d.name}.`);
          },
        });
        return;
      }
      case 'draw1expand1':
        await guard(async () => {
          await mutateHider((st) => beginDraw({ ...playCard(st, card), handLimit: st.handLimit + 1 }, 1, 1, d.name));
          await systemMessage(game.id, 'The hider expanded their hand.');
        });
        return;
      case 'duplicate':
        if (others.length === 0) return toast('Nothing to duplicate.');
        setPicked([]);
        setPick({
          card,
          need: 1,
          title: 'Choose a card to duplicate',
          exclude: card,
          run: async ([target]) => {
            await mutateHider((st) => duplicateCard(st, card, target));
          },
        });
        return;
      case 'move': {
        if (game.status === 'hiding') return toast('You can only Move once seeking has begun.');
        const mins = SIZES[game.size].moveMinutes;
        if (!confirm(`Play Move? Seekers freeze for ${mins} minutes while you relocate. Remember to set your new hiding zone!`)) return;
        await guard(async () => {
          await mutateHider((st) => ({ ...playCard(st, card), zone: null }));
          const until = new Date(Date.now() + mins * 60_000);
          await setMoveUntil(game, until);
          await castEffect(game, d.id, until);
          await sendMessage({ game_id: game.id, kind: 'card', body: d.name, meta: { card_id: d.id } });
        });
        return;
      }
    }
  }

  async function discard(card: string) {
    if (!confirm('Discard this card?')) return;
    await guard(async () => {
      await mutateHider((st) => discardCards(st, [card]));
    });
  }

  return (
    <div className="stack">
      <div className="row spread wrap">
        <div>
          <h3>Your hand</h3>
          <div className="small muted">
            {s.hand.length}/{s.handLimit} cards · {s.deck.length} in deck · bonus held: <b style={{ color: 'var(--ok)' }}>+{bonus} min</b>
            {s.chaliceRemaining > 0 && `, chalice ×${s.chaliceRemaining}`}
          </div>
        </div>
      </div>
      {s.hand.length === 0 ? (
        <div className="card muted">No cards yet. You draw cards every time you answer a question.</div>
      ) : (
        <div className="hand">
          {s.hand.map((c) => (
            <CardView key={c} card={c} size={game.size} onClick={() => setOpen(c)} />
          ))}
        </div>
      )}
      <div className="card small muted">
        <b>How cards work:</b> time bonuses add to your score if you’re holding them when found. Power-ups help you dodge questions. Curses slow
        the seekers down — pay the casting cost, then play. You may hold {s.handLimit} cards at most.
      </div>

      {open && (
        <div className="menu" onClick={() => setOpen(null)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <CardView card={open} size={game.size} big />
            {cardDef(open).kind !== 'time' && (
              <button className="btn primary block" disabled={busy || !inPlay} onClick={() => play(open)}>
                {cardDef(open).kind === 'curse' ? 'Cast curse' : 'Play card'}
              </button>
            )}
            <button className="btn block" disabled={busy} onClick={() => discard(open)}>
              Discard
            </button>
            <button className="btn ghost block" onClick={() => setOpen(null)}>
              Close
            </button>
          </div>
        </div>
      )}

      {pick && (
        <div className="menu">
          <div className="sheet">
            <h3>{pick.title}</h3>
            <div className="hand">
              {s.hand
                .filter((c) => c !== pick.exclude)
                .map((c) => (
                  <CardView
                    key={c}
                    card={c}
                    size={game.size}
                    selected={picked.includes(c)}
                    onClick={() => setPicked((p) => (p.includes(c) ? p.filter((x) => x !== c) : [...p, c].slice(-pick.need)))}
                  />
                ))}
            </div>
            <button
              className="btn primary block"
              disabled={busy || picked.length !== pick.need}
              onClick={async () => {
                const p = pick;
                setPick(null);
                await guard(() => p.run(picked));
              }}
            >
              Confirm
            </button>
            <button className="btn ghost block" onClick={() => setPick(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

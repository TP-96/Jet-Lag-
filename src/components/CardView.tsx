'use client';

import { cardDef } from '@/lib/game/deck';
import type { GameSize } from '@/lib/game/config';

export function CardView({
  card,
  size,
  selected,
  onClick,
  big,
}: {
  card: string;
  size: GameSize;
  selected?: boolean;
  onClick?: () => void;
  big?: boolean;
}) {
  const d = cardDef(card);
  const cls = `gcard ${d.kind} ${d.kind === 'time' ? d.tier : ''} ${selected ? 'selected' : ''} ${big ? 'big-card' : ''}`;
  if (d.kind === 'time') {
    return (
      <div className={cls} onClick={onClick}>
        <div className="kind">Time bonus{card.includes('#dup') ? ' (copy)' : ''}</div>
        <div className="big">+{d.minutes[size]}m</div>
        <div className="body muted">Added to your hiding time if you hold it when found.</div>
      </div>
    );
  }
  if (d.kind === 'powerup') {
    return (
      <div className={cls} onClick={onClick}>
        <div className="kind">Power-up</div>
        <div className="title">{d.name}</div>
        <div className="body">{d.text}</div>
      </div>
    );
  }
  return (
    <div className={cls} onClick={onClick}>
      <div className="kind">Curse{d.durationMin ? `, ${d.durationMin} min` : ''}</div>
      <div className="title">{d.name}</div>
      <div className="body">{d.effect}</div>
      <div className="cost">
        <b>Casting cost:</b> {d.cost}
      </div>
    </div>
  );
}

import { describe, expect, it } from 'vitest';
import {
  CARDS,
  beginDraw,
  buildDeck,
  cardDef,
  discardCards,
  duplicateCard,
  handTimeBonus,
  newHiderState,
  overLimit,
  resolveDraw,
  takeFromDeck,
} from '@/lib/game/deck';

describe('hider deck', () => {
  it('has 100 cards: 55 time, 21 power-ups, 24 curses', () => {
    const deck = buildDeck();
    expect(deck).toHaveLength(100);
    const count = (k: string) => deck.filter((c) => cardDef(c).kind === k).length;
    expect(count('time')).toBe(55);
    expect(count('powerup')).toBe(21);
    expect(count('curse')).toBe(24);
    expect(new Set(deck).size).toBe(100);
    expect(new Set(CARDS.map((c) => c.id)).size).toBe(CARDS.length);
  });

  it('draw X keep Y moves kept cards to hand and the rest to discard', () => {
    let s = newHiderState();
    s = beginDraw(s, 3, 1, 'test');
    expect(s.pending?.cards).toHaveLength(3);
    expect(s.deck).toHaveLength(97);
    const keep = s.pending!.cards[1];
    s = resolveDraw(s, [keep]);
    expect(s.hand).toEqual([keep]);
    expect(s.discard).toHaveLength(2);
    expect(s.pending).toBeNull();
  });

  it('rejects keeping the wrong number of cards', () => {
    const s = beginDraw(newHiderState(), 4, 2, 'test');
    expect(() => resolveDraw(s, [s.pending!.cards[0]])).toThrow();
  });

  it('overflowing chalice adds one extra card to draw and keep for 3 questions', () => {
    let s = { ...newHiderState(), chaliceRemaining: 3 };
    s = beginDraw(s, 2, 1, 'q', true);
    expect(s.pending!.cards).toHaveLength(3);
    expect(s.pending!.keep).toBe(2);
    expect(s.chaliceRemaining).toBe(2);
    s = resolveDraw(s, s.pending!.cards.slice(0, 2));
    s = beginDraw(s, 2, 1, 'powerup', false);
    expect(s.pending!.cards).toHaveLength(2);
  });

  it('reshuffles the discard pile when the deck runs out', () => {
    const s = { ...newHiderState(), deck: ['time-red#1'], discard: ['time-red#2', 'time-red#3', 'time-red#dup1'] };
    const { state, cards } = takeFromDeck(s, 3);
    expect(cards).toHaveLength(3);
    expect(cards).not.toContain('time-red#dup1');
    expect(state.discard).toEqual([]);
  });

  it('duplicate doubles a time bonus and hand limit is enforced', () => {
    let s = { ...newHiderState(), hand: ['time-blue#1', 'power-duplicate#1'] };
    s = duplicateCard(s, 'power-duplicate#1', 'time-blue#1');
    expect(handTimeBonus(s.hand, 'small')).toBe(24);
    expect(handTimeBonus(s.hand, 'large')).toBe(60);
    s = { ...s, hand: [...s.hand, 'time-red#1', 'time-red#2', 'time-red#3', 'time-red#4', 'time-red#5'] };
    expect(overLimit(s)).toBe(1);
    s = discardCards(s, ['time-red#5']);
    expect(overLimit(s)).toBe(0);
  });
});

import { standings } from '@/lib/game/scoring';

describe('standings', () => {
  it('ranks by best hide and puts players who never hid last', () => {
    const s = standings(['a', 'b', 'c'], [
      { hider_id: 'a', total_ms: 1000 },
      { hider_id: 'b', total_ms: 5000 },
      { hider_id: 'a', total_ms: 7000 },
    ]);
    expect(s.map((x) => x.userId)).toEqual(['a', 'b', 'c']);
    expect(s[0]).toEqual({ userId: 'a', best: 7000, rounds: 2 });
    expect(s[2].best).toBe(-1);
  });
});

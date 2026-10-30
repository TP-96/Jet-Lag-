import { HAND_LIMIT, type GameSize } from './config';

export type CardKind = 'time' | 'powerup' | 'curse';
export type PowerupKind = 'veto' | 'randomize' | 'discard1draw2' | 'discard2draw3' | 'draw1expand1' | 'duplicate' | 'move';

interface BaseCard {
  id: string;
  kind: CardKind;
  name: string;
  copies: number;
}

export interface TimeCard extends BaseCard {
  kind: 'time';
  tier: 'red' | 'orange' | 'yellow' | 'green' | 'blue';
  minutes: Record<GameSize, number>;
}

export interface PowerupCard extends BaseCard {
  kind: 'powerup';
  powerup: PowerupKind;
  text: string;
}

export interface CurseCard extends BaseCard {
  kind: 'curse';
  effect: string;
  cost: string;
  /** Timed curses show a countdown for the seekers. */
  durationMin?: number;
}

export type CardDef = TimeCard | PowerupCard | CurseCard;

const time = (tier: TimeCard['tier'], copies: number, s: number, m: number, l: number): TimeCard => ({
  id: `time-${tier}`,
  kind: 'time',
  name: 'Time Bonus',
  tier,
  copies,
  minutes: { small: s, medium: m, large: l },
});

const power = (powerup: PowerupKind, name: string, copies: number, text: string): PowerupCard => ({
  id: `power-${powerup}`,
  kind: 'powerup',
  powerup,
  name,
  copies,
  text,
});

const curse = (id: string, name: string, effect: string, cost: string, durationMin?: number): CurseCard => ({
  id: `curse-${id}`,
  kind: 'curse',
  name,
  copies: 1,
  effect,
  cost,
  durationMin,
});

// 55 time bonuses + 21 power-ups + 24 curses = 100 cards, mirroring the hider deck from the show's home game.
// Card text is written for this app and adapted to a single city's transit network.
export const CARDS: CardDef[] = [
  time('red', 25, 2, 3, 5),
  time('orange', 15, 4, 6, 10),
  time('yellow', 10, 6, 9, 15),
  time('green', 3, 8, 12, 20),
  time('blue', 2, 12, 18, 30),

  power('veto', 'Veto Question', 4, 'Play instead of answering a question. You still get the card draw for it.'),
  power('randomize', 'Randomize Question', 4, 'Play instead of answering. The question is swapped for a random unasked question in the same category, which you must answer.'),
  power('discard1draw2', 'Discard 1, Draw 2', 4, 'Discard 1 card from your hand, then draw 2.'),
  power('discard2draw3', 'Discard 2, Draw 3', 4, 'Discard 2 cards from your hand, then draw 3.'),
  power('draw1expand1', 'Draw 1, Expand 1', 2, 'Draw 1 card and permanently increase your hand limit by 1.'),
  power('duplicate', 'Duplicate', 2, 'Becomes a copy of any other card in your hand (time bonuses count twice!).'),
  power('move', 'Move', 1, 'Seekers must stay where they are. You get a fresh hiding period to relocate to a new hiding zone. Your clock keeps running.'),

  curse('zoologist', 'Curse of the Zoologist', 'Send a photo of a wild animal. Seekers must photograph an animal of the same kind (bird, insect, mammal…) before asking another question.', 'A photo of a wild animal.'),
  curse('unguided-tourist', 'Curse of the Unguided Tourist', 'Send the seekers a Street View screenshot from within 150 m of them (no street names). They must find the spot and take a matching photo before asking another question.', 'Seekers must be off transit.'),
  curse('endless-tumble', 'Curse of the Endless Tumble', 'Seekers must roll a die at least 30 m along the ground and land a 5 or 6 before asking another question. Each attempt costs them a new roll.', 'Roll a die yourself; on a 1 the curse fizzles.'),
  curse('hidden-hangman', 'Curse of the Hidden Hangman', 'Seekers must beat you at hangman (5 wrong guesses allowed) before asking another question or boarding transit. A loss means a 5 minute wait before trying again.', 'Discard 2 cards.'),
  curse('overflowing-chalice', 'Curse of the Overflowing Chalice', 'For the next 3 questions, you draw 1 extra card whenever you draw (handled automatically).', 'Discard 1 card.'),
  curse('mediocre-travel-agent', 'Curse of the Mediocre Travel Agent', 'Pick any public place within 500 m of the seekers. They must go there, spend 5 minutes, and send you 3 photos before asking another question.', 'The place must be farther from you than they currently are.'),
  curse('luxury-car', 'Curse of the Luxury Car', 'Send a photo of a car. Seekers must photograph a car they believe is more expensive before asking another question. You judge.', 'A photo of a car.'),
  curse('u-turn', 'Curse of the U-Turn', 'Seekers must get off at the next stop and travel in the opposite direction for at least one stop.', 'Seekers must currently be heading the wrong way (you can tell from their questions).'),
  curse('bridge-troll', 'Curse of the Bridge Troll', 'Seekers must ask their next question from underneath a bridge or overpass.', 'Seekers must be at least 1.5 km from you.'),
  curse('water-weight', 'Curse of the Water Weight', 'Each seeker must buy and carry at least 1.5 L of liquid for the rest of the round. Drinking it is allowed, but it must be replaced.', 'Seekers must be within 300 m of a body of water.'),
  curse('jammed-door', 'Curse of the Jammed Door', 'For 30 minutes, every time a seeker wants to go through a door (building or vehicle) they must roll 2 dice; 7+ to pass, otherwise wait one minute and try again.', 'Discard 2 cards.', 30),
  curse('cairn', 'Curse of the Cairn', 'Build a rock tower as tall as you can in one attempt and send a photo. Seekers must build one with at least as many stones before asking another question.', 'Build the tower.'),
  curse('urban-explorer', 'Curse of the Urban Explorer', 'For the rest of the round seekers cannot ask questions while on transit or inside a station.', 'Discard 2 cards.'),
  curse('impressionable-consumer', 'Curse of the Impressionable Consumer', 'Seekers must enter a business they saw advertised and buy something before asking another question.', "Seekers' next question is free (no card draw for you)."),
  curse('egg-partner', 'Curse of the Egg Partner', 'Seekers must buy a raw egg and keep it unbroken for the rest of the round. If it breaks, you get a 30 minute bonus.', 'Discard 2 cards.'),
  curse('distant-cuisine', 'Curse of the Distant Cuisine', "Go to a restaurant serving a specific country's food and send a photo. Seekers must visit a restaurant serving food from a country at least as far away before asking another question.", 'You must be at the restaurant when you play this.'),
  curse('right-turn', 'Curse of the Right Turn', 'For 20 minutes seekers may only turn right at intersections. Dead ends allow a U-turn.', 'Discard 1 card.', 20),
  curse('labyrinth', 'Curse of the Labyrinth', 'Draw a maze (up to 10 minutes) and send a photo. Seekers must solve it before asking another question.', 'Spend up to 10 minutes drawing it.'),
  curse('bird-guide', 'Curse of the Bird Guide', 'Film a bird for as long as you can (up to 5 minutes). Seekers must film a bird for at least as long before asking another question.', 'Film the bird.'),
  curse('spotty-memory', 'Curse of the Spotty Memory', 'For the rest of the round, one random question category is disabled. It re-rolls every time the seekers ask a question.', 'Discard a time bonus card.'),
  curse('lemon-phylactery', 'Curse of the Lemon Phylactery', 'Before their next question each seeker must attach a lemon to their outer clothing. If one ever falls off, you get a 30 minute bonus.', 'Discard a power-up card.'),
  curse('drained-brain', 'Curse of the Drained Brain', 'Pick three questions from different categories. Seekers cannot ask them for the rest of the round.', 'Discard your whole hand.'),
  curse('ransom-note', 'Curse of the Ransom Note', "Seekers' next question must be spelled out using letters/words cut or photographed from printed material.", 'Send this curse as a ransom note yourself.'),
  curse('gamblers-feet', "Curse of the Gambler's Feet", 'For 20 minutes, before walking anywhere seekers must roll a die and may only take that many steps per roll.', 'Roll a die; on an even number the curse fizzles.', 20),
];

export const CARD_BY_ID: Record<string, CardDef> = Object.fromEntries(CARDS.map((c) => [c.id, c]));

/** Instance ids look like `time-red#7` — the def id plus a copy number. */
export function cardDef(instanceId: string): CardDef {
  const def = CARD_BY_ID[instanceId.split('#')[0]];
  if (!def) throw new Error(`Unknown card ${instanceId}`);
  return def;
}

export function buildDeck(): string[] {
  return CARDS.flatMap((c) => Array.from({ length: c.copies }, (_, i) => `${c.id}#${i + 1}`));
}

export function shuffle<T>(arr: T[], rand: () => number = secureRandom): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function secureRandom(): number {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return buf[0] / 2 ** 32;
  }
  return Math.random();
}

export interface HiderState {
  deck: string[];
  hand: string[];
  discard: string[];
  handLimit: number;
  /** Questions remaining under the Curse of the Overflowing Chalice. */
  chaliceRemaining: number;
  /** Cards drawn but not yet chosen (draw X, keep Y). */
  pending: { cards: string[]; keep: number; reason: string } | null;
  dupCounter: number;
  /** Centre of the hider's chosen hiding zone (their transit station). Private to the hider. */
  zone: { lat: number; lng: number; label?: string } | null;
}

export function newHiderState(rand?: () => number): HiderState {
  return {
    deck: shuffle(buildDeck(), rand),
    hand: [],
    discard: [],
    handLimit: HAND_LIMIT,
    chaliceRemaining: 0,
    pending: null,
    dupCounter: 0,
    zone: null,
  };
}

/** Pull `n` cards off the top of the deck, reshuffling the discard pile in if the deck runs out. */
export function takeFromDeck(state: HiderState, n: number, rand?: () => number): { state: HiderState; cards: string[] } {
  let deck = [...state.deck];
  let discard = [...state.discard];
  const cards: string[] = [];
  for (let i = 0; i < n; i++) {
    if (deck.length === 0) {
      if (discard.length === 0) break;
      // Duplicate copies are temporary — they don't get shuffled back into the deck.
      deck = shuffle(discard.filter((c) => !c.includes('#dup')), rand);
      if (deck.length === 0) break;
      discard = [];
    }
    cards.push(deck.shift()!);
  }
  return { state: { ...state, deck, discard }, cards };
}

/** Start a "draw X keep Y" choice. Applies the Overflowing Chalice bonus when `fromQuestion`. */
export function beginDraw(state: HiderState, draw: number, keep: number, reason: string, fromQuestion = false, rand?: () => number): HiderState {
  let extra = 0;
  let chaliceRemaining = state.chaliceRemaining;
  if (fromQuestion && chaliceRemaining > 0) {
    extra = 1;
    chaliceRemaining -= 1;
  }
  const { state: s, cards } = takeFromDeck(state, draw + extra, rand);
  // With the chalice you keep the extra card too.
  return { ...s, chaliceRemaining, pending: { cards, keep: Math.min(cards.length, keep + extra), reason } };
}

/** Resolve the pending draw by keeping the chosen cards; the rest are discarded. */
export function resolveDraw(state: HiderState, kept: string[]): HiderState {
  if (!state.pending) return state;
  const { cards, keep } = state.pending;
  if (kept.length !== keep || kept.some((c) => !cards.includes(c))) throw new Error(`Choose exactly ${keep} card(s).`);
  return {
    ...state,
    hand: [...state.hand, ...kept],
    discard: [...state.discard, ...cards.filter((c) => !kept.includes(c))],
    pending: null,
  };
}

export function discardCards(state: HiderState, cards: string[]): HiderState {
  if (cards.some((c) => !state.hand.includes(c))) throw new Error('Card not in hand');
  return { ...state, hand: state.hand.filter((c) => !cards.includes(c)), discard: [...state.discard, ...cards] };
}

export function overLimit(state: HiderState): number {
  return Math.max(0, state.hand.length - state.handLimit);
}

/** Move a played card from the hand to the discard pile. */
export function playCard(state: HiderState, card: string): HiderState {
  return discardCards(state, [card]);
}

/** Duplicate: the duplicate card is consumed and a copy of `target` joins the hand. */
export function duplicateCard(state: HiderState, dupCard: string, target: string): HiderState {
  if (dupCard === target) throw new Error('Pick a different card');
  if (!state.hand.includes(target)) throw new Error('Card not in hand');
  const s = playCard(state, dupCard);
  const copy = `${target.split('#')[0]}#dup${s.dupCounter + 1}`;
  return { ...s, hand: [...s.hand, copy], dupCounter: s.dupCounter + 1 };
}

/** Total time bonus (minutes) of time cards in hand — added to the hider's score when found. */
export function handTimeBonus(hand: string[], size: GameSize): number {
  return hand.reduce((sum, id) => {
    const d = cardDef(id);
    return d.kind === 'time' ? sum + d.minutes[size] : sum;
  }, 0);
}

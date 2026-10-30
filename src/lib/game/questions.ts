import type { GameSize } from './config';

export type CategoryId = 'matching' | 'measuring' | 'thermometer' | 'radar' | 'tentacles' | 'photo';
export type AnswerType = 'yesno' | 'closerfurther' | 'hotcold' | 'text' | 'photo';

export interface Category {
  id: CategoryId;
  name: string;
  icon: string;
  color: string;
  /** Hider reward for answering: draw `draw` cards, keep `keep`. */
  draw: number;
  keep: number;
  /** Multiplier on the base answer time (photos take longer). */
  timeMultiplier: number;
  description: string;
}

export const CATEGORIES: Record<CategoryId, Category> = {
  matching: {
    id: 'matching',
    name: 'Matching',
    icon: '🟰',
    color: '#1e63d6',
    draw: 3,
    keep: 1,
    timeMultiplier: 1,
    description: 'Is your nearest ___ the same as my nearest ___?',
  },
  measuring: {
    id: 'measuring',
    name: 'Measuring',
    icon: '📏',
    color: '#009a5b',
    draw: 3,
    keep: 1,
    timeMultiplier: 1,
    description: 'Compared to me, are you closer to or further from ___?',
  },
  thermometer: {
    id: 'thermometer',
    name: 'Thermometer',
    icon: '🌡️',
    color: '#e6731a',
    draw: 2,
    keep: 1,
    timeMultiplier: 1,
    description: 'I just travelled at least X. Am I hotter or colder? (answered automatically from GPS)',
  },
  radar: {
    id: 'radar',
    name: 'Radar',
    icon: '📡',
    color: '#c2185b',
    draw: 2,
    keep: 1,
    timeMultiplier: 1,
    description: 'Are you within X of me? (answered automatically from GPS)',
  },
  tentacles: {
    id: 'tentacles',
    name: 'Tentacles',
    icon: '🐙',
    color: '#6d3fc0',
    draw: 4,
    keep: 2,
    timeMultiplier: 1,
    description: 'Of all the ___ within X of me, which are you closest to?',
  },
  photo: {
    id: 'photo',
    name: 'Photos',
    icon: '📸',
    color: '#0097a7',
    draw: 1,
    keep: 1,
    timeMultiplier: 2,
    description: 'Send me a photo of ___.',
  },
};

export const CATEGORY_ORDER: CategoryId[] = ['matching', 'measuring', 'thermometer', 'radar', 'tentacles', 'photo'];

export interface QuestionDef {
  id: string;
  category: CategoryId;
  text: string;
  answerType: AnswerType;
  sizes: GameSize[];
  /** Distance parameter (metres) for radar / thermometer / tentacles. */
  distanceM?: number;
  /** Radar question where seekers choose their own distance. */
  customDistance?: boolean;
}

const ALL: GameSize[] = ['small', 'medium', 'large'];
const ML: GameSize[] = ['medium', 'large'];
const L: GameSize[] = ['large'];

const matching: [string, string, GameSize[]][] = [
  ['transit-line', 'Is your nearest transit line (bus route, metro or rail line) the same as mine?', ALL],
  ['station-name-length', "Is your nearest station's name the same length as mine?", ALL],
  ['street', 'Is your nearest street or path the same as mine?', ALL],
  ['neighbourhood', 'Is your neighbourhood / ward the same as mine?', ALL],
  ['park', 'Is your nearest park the same as mine?', ALL],
  ['museum', 'Is your nearest museum the same as mine?', ALL],
  ['library', 'Is your nearest library the same as mine?', ALL],
  ['hospital', 'Is your nearest hospital the same as mine?', ALL],
  ['cinema', 'Is your nearest movie theatre the same as mine?', ALL],
  ['school', 'Is your nearest university or college campus the same as mine?', ALL],
  ['grocery', 'Is your nearest grocery store brand the same as mine?', ALL],
  ['coffee', 'Is your nearest coffee chain location the same as mine?', ALL],
  ['golf', 'Is your nearest golf course the same as mine?', ML],
  ['zoo', 'Is your nearest zoo the same as mine?', ML],
  ['aquarium', 'Is your nearest aquarium the same as mine?', ML],
  ['amusement', 'Is your nearest amusement park the same as mine?', ML],
  ['municipality', 'Is your municipality / city the same as mine?', ML],
  ['airport', 'Is your nearest commercial airport the same as mine?', L],
  ['mountain', 'Is your nearest mountain / escarpment peak the same as mine?', L],
];

const measuring: [string, string, GameSize[]][] = [
  ['rail-station', 'Compared to me, are you closer to or further from a rail / rapid transit station?', ALL],
  ['water', 'Compared to me, are you closer to or further from a body of water?', ALL],
  ['park', 'Compared to me, are you closer to or further from a park?', ALL],
  ['museum', 'Compared to me, are you closer to or further from a museum?', ALL],
  ['library', 'Compared to me, are you closer to or further from a library?', ALL],
  ['hospital', 'Compared to me, are you closer to or further from a hospital?', ALL],
  ['cinema', 'Compared to me, are you closer to or further from a movie theatre?', ALL],
  ['city-hall', 'Compared to me, are you closer to or further from city hall?', ALL],
  ['stadium', 'Compared to me, are you closer to or further from a stadium or arena?', ALL],
  ['mcdonalds', "Compared to me, are you closer to or further from a McDonald's?", ALL],
  ['ward-border', 'Compared to me, are you closer to or further from a ward / neighbourhood border?', ALL],
  ['highway', 'Compared to me, are you closer to or further from a highway?', ALL],
  ['sea-level', 'Compared to me, are you higher or lower in elevation? (answer “closer” = lower)', ML],
  ['golf', 'Compared to me, are you closer to or further from a golf course?', ML],
  ['zoo', 'Compared to me, are you closer to or further from a zoo or aquarium?', ML],
  ['city-border', 'Compared to me, are you closer to or further from the city limits?', ML],
  ['airport', 'Compared to me, are you closer to or further from a commercial airport?', L],
  ['coastline', 'Compared to me, are you closer to or further from a coastline / lakeshore?', L],
];

const thermo: [string, number, GameSize[]][] = [
  ['500m', 500, ALL],
  ['2km', 2000, ALL],
  ['5km', 5000, ML],
  ['15km', 15000, L],
];

const radar: [string, number, GameSize[]][] = [
  ['250m', 250, ALL],
  ['500m', 500, ALL],
  ['1km', 1000, ALL],
  ['2km', 2000, ALL],
  ['3km', 3000, ALL],
  ['5km', 5000, ALL],
  ['10km', 10000, ML],
  ['25km', 25000, L],
  ['50km', 50000, L],
];

const tentacles: [string, string, number, GameSize[]][] = [
  ['museum', 'museums', 1500, ALL],
  ['library', 'libraries', 1500, ALL],
  ['cinema', 'movie theatres', 1500, ALL],
  ['hospital', 'hospitals', 1500, ALL],
  ['park', 'parks', 1500, ALL],
  ['station', 'rail / rapid-transit stations', 3000, ALL],
  ['transit-line', 'transit lines', 15000, ML],
  ['zoo', 'zoos & aquariums', 15000, ML],
  ['amusement', 'amusement parks', 15000, ML],
  ['university', 'universities & colleges', 15000, ML],
];

const photos: [string, string, GameSize[]][] = [
  ['tree', 'a tree (whole tree in frame)', ALL],
  ['sky', 'the sky (phone flat on the ground, pointing straight up)', ALL],
  ['selfie', 'yourself (selfie, arm fully extended)', ALL],
  ['widest-street', 'the widest street you can see', ALL],
  ['tallest-structure', 'the tallest structure in your current sightline', ALL],
  ['building-from-station', 'any building visible from your nearest station', ALL],
  ['nearest-street-trace', 'your nearest street sign', ALL],
  ['restaurant', 'the interior of the nearest restaurant (without going in further than the door)', ALL],
  ['bus-stop', 'your nearest bus stop sign / pole', ALL],
  ['ground', 'the ground directly beneath your feet', ALL],
  ['tallest-building', 'the tallest building visible from your nearest station', ML],
  ['platform', 'a train / transit platform', ML],
  ['park', 'the nearest park entrance', ML],
  ['grocery-aisle', 'a grocery store aisle', ML],
  ['worship', 'a place of worship', ML],
  ['two-buildings', 'two buildings in one shot, as far apart as you can', ML],
  ['mountain', 'the tallest hill or mountain you can see', L],
  ['water', 'the biggest body of water within 1 km', L],
  ['five-buildings', 'five buildings in one shot', L],
];

export const QUESTIONS: QuestionDef[] = [
  ...matching.map(([id, text, sizes]) => ({ id: `matching:${id}`, category: 'matching' as const, text, answerType: 'yesno' as const, sizes })),
  ...measuring.map(([id, text, sizes]) => ({
    id: `measuring:${id}`,
    category: 'measuring' as const,
    text,
    answerType: 'closerfurther' as const,
    sizes,
  })),
  ...thermo.map(([id, d, sizes]) => ({
    id: `thermometer:${id}`,
    category: 'thermometer' as const,
    text: `I've just travelled at least {d}. Am I hotter or colder?`,
    answerType: 'hotcold' as const,
    sizes,
    distanceM: d,
  })),
  ...radar.map(([id, d, sizes]) => ({
    id: `radar:${id}`,
    category: 'radar' as const,
    text: `Are you within {d} of me?`,
    answerType: 'yesno' as const,
    sizes,
    distanceM: d,
  })),
  {
    id: 'radar:custom',
    category: 'radar',
    text: 'Are you within {d} of me? (seekers choose)',
    answerType: 'yesno',
    sizes: ALL,
    customDistance: true,
  },
  ...tentacles.map(([id, what, d, sizes]) => ({
    id: `tentacles:${id}`,
    category: 'tentacles' as const,
    text: `Of all the ${what} within {d} of me, which are you closest to?`,
    answerType: 'text' as const,
    sizes,
    distanceM: d,
  })),
  ...photos.map(([id, what, sizes]) => ({
    id: `photo:${id}`,
    category: 'photo' as const,
    text: `Send me a photo of ${what}.`,
    answerType: 'photo' as const,
    sizes,
  })),
];

export const QUESTION_BY_ID: Record<string, QuestionDef> = Object.fromEntries(QUESTIONS.map((q) => [q.id, q]));

export function questionsFor(size: GameSize): QuestionDef[] {
  return QUESTIONS.filter((q) => q.sizes.includes(size));
}

/** Answer time limit in ms. Photos take twice as long; large games double photo time again. */
export function answerTimeMs(category: CategoryId, size: GameSize, baseMinutes: number): number {
  let mult = CATEGORIES[category].timeMultiplier;
  if (category === 'photo' && size === 'large') mult *= 2;
  return baseMinutes * mult * 60_000;
}

export function renderQuestionText(q: QuestionDef, distanceText?: string): string {
  return q.text.replace('{d}', distanceText ?? '?');
}

/** Questions that can still be asked this round (each question may be asked once per round, custom radar excepted). */
export function availableQuestions(size: GameSize, askedIds: string[]): QuestionDef[] {
  const asked = new Set(askedIds);
  return questionsFor(size).filter((q) => q.customDistance || !asked.has(q.id));
}

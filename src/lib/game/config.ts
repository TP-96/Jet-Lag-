export type GameSize = 'small' | 'medium' | 'large';
export type Units = 'metric' | 'imperial';

export interface SizeConfig {
  label: string;
  blurb: string;
  hidingMinutes: number;
  /** Radius of the hiding zone around the hider's chosen transit station, in metres. */
  zoneRadiusM: number;
  /** Minutes the hider gets to re-hide when the Move power-up is played. */
  moveMinutes: number;
}

// Tuned for a single city's transit network. "Small" is the right pick for most cities:
// a full round lasts 1.5–3 hours. "Large" is for a whole metro region / day-long rounds.
export const SIZES: Record<GameSize, SizeConfig> = {
  small: {
    label: 'Small — downtown / one city',
    blurb: '30 min to hide, 400 m hiding zone. Great for a few hours on a city network.',
    hidingMinutes: 30,
    zoneRadiusM: 400,
    moveMinutes: 20,
  },
  medium: {
    label: 'Medium — whole city',
    blurb: '60 min to hide, 400 m hiding zone. For big networks with suburbs and regional rail.',
    hidingMinutes: 60,
    zoneRadiusM: 400,
    moveMinutes: 30,
  },
  large: {
    label: 'Large — metro region',
    blurb: '3 h to hide, 800 m hiding zone. A full-day game across a region.',
    hidingMinutes: 180,
    zoneRadiusM: 800,
    moveMinutes: 60,
  },
};

export const HAND_LIMIT = 6;

export interface GameSettings {
  units: Units;
  /** If true the hider can see seekers' live positions (off in the show — keeps it fair). */
  hiderSeesSeekers: boolean;
  /** Minutes the hider has to answer a question (photos get double; large games double again). */
  answerMinutes: number;
  /** Free-form note shown in the lobby, e.g. "HSR buses + GO train only, no cabs". */
  transitRules: string;
}

export const DEFAULT_SETTINGS: GameSettings = {
  units: 'metric',
  hiderSeesSeekers: false,
  answerMinutes: 5,
  transitRules: 'Public transit and walking only. No cabs, bikes, scooters or rideshare.',
};

export function formatDistance(m: number, units: Units): string {
  if (units === 'imperial') {
    const ft = m * 3.28084;
    if (ft < 1000) return `${Math.round(ft)} ft`;
    const mi = m / 1609.344;
    return `${mi < 10 ? mi.toFixed(2).replace(/\.?0+$/, '') : Math.round(mi)} mi`;
  }
  if (m < 1000) return `${Math.round(m)} m`;
  const km = m / 1000;
  return `${km < 10 ? km.toFixed(1).replace(/\.0$/, '') : Math.round(km)} km`;
}

export function formatDuration(ms: number): string {
  const neg = ms < 0;
  let s = Math.floor(Math.abs(ms) / 1000);
  const h = Math.floor(s / 3600);
  s -= h * 3600;
  const m = Math.floor(s / 60);
  s -= m * 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${neg ? '-' : ''}${h > 0 ? `${h}:${pad(m)}` : m}:${pad(s)}`;
}

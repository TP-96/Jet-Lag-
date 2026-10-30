'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import type { HiderState } from '@/lib/game/deck';
import type { LocationStatus } from '@/lib/useLocation';
import type { GameData } from '@/lib/useGame';
import type { Game, Player } from '@/lib/types';

export interface GameCtx extends Omit<GameData, 'game' | 'me'> {
  game: Game;
  me: string;
  myPlayer: Player | undefined;
  isHider: boolean;
  isHost: boolean;
  position: GeolocationPosition | null;
  locStatus: LocationStatus;
  player: (id: string | null | undefined) => Player | undefined;
  mutateHider: (fn: (s: HiderState) => HiderState) => Promise<HiderState | null>;
  toast: (text: string) => void;
}

export const GameContext = createContext<GameCtx | null>(null);

export function useGameCtx(): GameCtx {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGameCtx outside GameContext');
  return ctx;
}

/** Re-render every `ms` for live timers. */
export function useNow(ms = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}

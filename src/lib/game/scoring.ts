export interface RoundScore {
  hider_id: string;
  total_ms: number;
}

export interface Standing {
  userId: string;
  best: number;
  rounds: number;
}

/** Ranked by each player's best hide (longest wins), as in the show. Players who never hid come last. */
export function standings(playerIds: string[], rounds: RoundScore[]): Standing[] {
  return playerIds
    .map((userId) => {
      const mine = rounds.filter((r) => r.hider_id === userId);
      return { userId, best: mine.length ? Math.max(...mine.map((r) => r.total_ms)) : -1, rounds: mine.length };
    })
    .sort((a, b) => b.best - a.best);
}

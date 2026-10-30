'use client';

import { declareEndgame, markFound } from '@/lib/actions';
import { SIZES, formatDuration } from '@/lib/game/config';
import { standings } from '@/lib/game/scoring';
import { useGameCtx } from './GameContext';

export default function StatusBar({ now }: { now: number }) {
  const { game, isHider, myPlayer, player, players, rounds, toast, live } = useGameCtx();
  const hider = player(game.hider_id);
  let label = 'Lobby';
  let clock = `Round ${game.round}`;
  let sub = `${game.code} · ${SIZES[game.size].label.split(' — ')[0]}`;

  if (game.status === 'hiding' && game.hide_started_at) {
    const end = new Date(game.hide_started_at).getTime() + SIZES[game.size].hidingMinutes * 60_000;
    label = isHider ? 'Hide! Time left' : 'Hider is hiding';
    clock = formatDuration(Math.max(0, end - now));
    sub = isHider ? 'Get to your hiding spot' : 'Seekers: stay put';
  } else if ((game.status === 'seeking' || game.status === 'endgame') && game.seek_started_at) {
    label = game.status === 'endgame' ? 'ENDGAME' : 'Seeking';
    clock = formatDuration(now - new Date(game.seek_started_at).getTime());
    sub = `${hider?.avatar ?? ''} ${hider?.name ?? 'Hider'} hiding`;
  } else if (game.status === 'round_over') {
    const r = rounds.find((x) => x.round === game.round);
    label = `Round ${game.round} over`;
    clock = r ? formatDuration(r.total_ms) : game.found_at && game.seek_started_at ? formatDuration(new Date(game.found_at).getTime() - new Date(game.seek_started_at).getTime()) : '—';
    sub = r ? `incl. +${Math.round(r.bonus_ms / 60000)}m bonus` : 'waiting for hider’s bonus…';
  }

  if (game.status === 'finished') {
    const top = standings(players.map((p) => p.user_id), rounds)[0];
    const champ = top && top.best >= 0 ? player(top.userId) : undefined;
    label = 'Game over';
    clock = champ ? `👑 ${champ.name}` : '🏁';
    sub = champ ? `Champion · best hide ${formatDuration(top.best)}` : `${rounds.length} rounds played`;
  }

  const endgame = async () => {
    if (!confirm('Declare ENDGAME? Only do this when your team is inside the hiding zone and OFF transit.')) return;
    await declareEndgame(game, myPlayer?.name ?? 'Seekers').catch((e) => toast(e.message));
  };
  const found = async () => {
    const msg = isHider ? 'Confirm the seekers have found you?' : 'Confirm you have physically found (spotted & reached) the hider?';
    if (!confirm(msg)) return;
    await markFound(game, isHider ? `${myPlayer?.name} (hider) confirmed —` : (myPlayer?.name ?? 'A seeker')).catch((e) => toast(e.message));
  };

  return (
    <header className={`topbar phase-${game.status}`}>
      <div className="phase">
        <div>
          <div className="label">{label}</div>
          <div className="clock">{clock}</div>
          <div className="small muted">
            {sub}
            {!live && <span title="Realtime disconnected — syncing every few seconds"> · 📶 syncing</span>}
          </div>
        </div>
        <div className="row">
          {!isHider && game.status === 'seeking' && (
            <button className="btn small danger" onClick={endgame}>
              🚨 Endgame
            </button>
          )}
          {(game.status === 'seeking' || game.status === 'endgame') && (
            <button className="btn small ok" onClick={found}>
              🎯 Found
            </button>
          )}
          <span className={`tag ${isHider ? 'hider' : 'seeker'}`}>
            {myPlayer?.avatar} {game.status === 'lobby' || game.status === 'finished' ? 'Player' : isHider ? 'Hider' : 'Seeker'}
          </span>
        </div>
      </div>
    </header>
  );
}

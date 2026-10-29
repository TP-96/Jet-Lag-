'use client';

import { useState } from 'react';
import Link from 'next/link';
import { backToLobby, finishGame, leaveGame, resetGame, startRound, updateSettings } from '@/lib/actions';
import { standings } from '@/lib/game/scoring';
import { SIZES, formatDistance, formatDuration, type GameSize } from '@/lib/game/config';
import { useGameCtx, useNow } from './GameContext';
import ThemeToggle from './ThemeToggle';
import type { CelebrationKind } from './Celebration';

export default function TeamPanel({ onCelebrate }: { onCelebrate: (k: CelebrationKind) => void }) {
  const { game, players, rounds, isHost, me, toast, locations, locStatus } = useGameCtx();
  const now = useNow(10_000);
  const hidCount = (id: string) => rounds.filter((r) => r.hider_id === id).length;
  const nextUp = [...players].sort((a, b) => hidCount(a.user_id) - hidCount(b.user_id) || a.joined_at.localeCompare(b.joined_at))[0];
  const [hider, setHider] = useState<string | null>(null);
  const chosen = hider ?? nextUp?.user_id ?? null;
  const [busy, setBusy] = useState(false);
  const canStart = isHost && (game.status === 'lobby' || game.status === 'round_over') && players.length >= 2 && chosen;

  const ranked = standings(players.map((p) => p.user_id), rounds);
  const best = new Map(ranked.filter((r) => r.best >= 0).map((r) => [r.userId, r.best]));
  const board = ranked.map((r) => players.find((p) => p.user_id === r.userId)!).filter(Boolean);
  const champion = ranked[0] && ranked[0].best >= 0 ? players.find((p) => p.user_id === ranked[0].userId) : undefined;

  const share = async () => {
    const url = `${process.env.NEXT_PUBLIC_SITE_URL || window.location.origin}/game?code=${game.code}`;
    try {
      if (navigator.share) await navigator.share({ title: game.name, text: `Join my Hide + Seek game! Code ${game.code}`, url });
      else {
        await navigator.clipboard.writeText(url);
        toast('Link copied!');
      }
    } catch {}
  };

  return (
    <div className="stack">
      <div className="card stack">
        <div className="row spread">
          <div>
            <h2>{game.name}</h2>
            <div className="small muted">
              Code <b style={{ letterSpacing: '.15em', color: 'var(--accent-text)' }}>{game.code}</b> · {SIZES[game.size].label}
            </div>
          </div>
          <button className="btn small" onClick={share}>
            🔗 Invite
          </button>
        </div>
        <div className="small muted">🚆 {game.settings.transitRules}</div>
        <div className="small muted">
          📍 Location: {locStatus === 'active' ? 'sharing ✅' : locStatus === 'denied' ? 'blocked ❌' : locStatus === 'prompt' ? 'waiting for permission…' : locStatus}
          {typeof Notification !== 'undefined' && Notification.permission === 'default' && (
            <>
              {' · '}
              <button className="btn small ghost" onClick={() => Notification.requestPermission()}>
                🔔 Enable alerts
              </button>
            </>
          )}
        </div>
      </div>

      <div className="card">
        <h3>Players ({players.length})</h3>
        {players.map((p) => {
          const loc = locations.find((l) => l.user_id === p.user_id);
          const online = now - new Date(loc?.updated_at ?? p.last_seen).getTime() < 120_000;
          return (
            <div key={p.user_id} className="player-row">
              <div className="pin" style={{ background: p.color, width: 36, height: 36 }}>
                {p.avatar}
              </div>
              <div style={{ flex: 1 }}>
                <div>
                  <b>{p.name}</b> {p.user_id === me && <span className="muted small">(you)</span>} {p.user_id === game.host_id && <span className="small">👑</span>}
                </div>
                <div className="small muted">
                  <span className="dot" style={{ background: online ? 'var(--ok)' : 'var(--muted)' }} /> {online ? 'online' : 'offline'} · hid{' '}
                  {hidCount(p.user_id)}×
                </div>
              </div>
              {game.status !== 'lobby' && game.status !== 'round_over' ? (
                <span className={`tag ${game.hider_id === p.user_id ? 'hider' : 'seeker'}`}>{game.hider_id === p.user_id ? 'Hider' : 'Seeker'}</span>
              ) : (
                isHost && (
                  <button className={`btn small ${chosen === p.user_id ? 'primary' : ''}`} onClick={() => setHider(p.user_id)}>
                    {chosen === p.user_id ? '🫣 Hider' : 'Make hider'}
                  </button>
                )
              )}
            </div>
          );
        })}
      </div>

      {(game.status === 'lobby' || game.status === 'round_over') && (
        <div className="card stack">
          {isHost ? (
            <>
              <h3>Next round</h3>
              <label className="field">
                Game size
                <select className="input" value={game.size} onChange={(e) => updateSettings(game, { size: e.target.value as GameSize })}>
                  {(Object.keys(SIZES) as GameSize[]).map((s) => (
                    <option key={s} value={s}>
                      {SIZES[s].label}
                    </option>
                  ))}
                </select>
                <span className="small">
                  {SIZES[game.size].hidingMinutes} min hiding · {formatDistance(SIZES[game.size].zoneRadiusM, game.settings.units)} hiding zone
                </span>
              </label>
              <label className="field">
                Transit rules (shown to everyone)
                <textarea
                  className="input"
                  rows={2}
                  defaultValue={game.settings.transitRules}
                  onBlur={(e) => updateSettings(game, { settings: { transitRules: e.target.value } })}
                />
              </label>
              <label className="row small">
                <input
                  type="checkbox"
                  checked={game.settings.hiderSeesSeekers}
                  onChange={(e) => updateSettings(game, { settings: { hiderSeesSeekers: e.target.checked } })}
                />
                Hider can see seekers on the map (easier for the hider)
              </label>
              <label className="row small">
                Answer time
                <select
                  className="input"
                  style={{ width: 110 }}
                  value={game.settings.answerMinutes}
                  onChange={(e) => updateSettings(game, { settings: { answerMinutes: Number(e.target.value) } })}
                >
                  {[3, 5, 7, 10].map((m) => (
                    <option key={m} value={m}>
                      {m} min
                    </option>
                  ))}
                </select>
              </label>
              <button
                className="btn primary block"
                disabled={!canStart || busy}
                onClick={async () => {
                  setBusy(true);
                  await startRound(game, players, chosen!).catch((e) => toast(e.message));
                  setBusy(false);
                }}
              >
                🏁 Start round {game.round + 1} {players.length < 2 && '(need 2+ players)'}
              </button>
            </>
          ) : (
            <div className="muted">Waiting for the host to start the next round…</div>
          )}
        </div>
      )}

      {game.status === 'round_over' && isHost && (
        <button className="btn ghost" onClick={() => backToLobby(game)}>
          Back to lobby
        </button>
      )}

      {isHost && (game.status === 'lobby' || game.status === 'round_over') && rounds.length > 0 && (
        <button
          className="btn block"
          onClick={() => confirm('End the game and crown the winner?') && finishGame(game, champion?.name ?? null).catch((e) => toast(e.message))}
        >
          🏁 End game &amp; crown the winner
        </button>
      )}

      {game.status === 'finished' && (
        <div className="card stack" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 48 }}>👑</div>
          <h2>{champion ? `${champion.avatar} ${champion.name} wins!` : 'Game over'}</h2>
          {champion && <div className="muted">Best hide: {formatDuration(best.get(champion.user_id)!)}</div>}
          <button className="btn primary block" onClick={() => onCelebrate('winner')}>
            🎉 Replay the celebration
          </button>
          {isHost && (
            <button className="btn block" onClick={() => confirm('Start a new game with the same players? Scores reset.') && resetGame(game).catch((e) => toast(e.message))}>
              🔄 Play again
            </button>
          )}
        </div>
      )}

      <div className="card">
        <h3>🏆 Leaderboard</h3>
        <p className="small muted">Score = time from seeking start until found + time bonus cards in hand. Longest hide wins.</p>
        {rounds.length === 0 ? (
          <p className="muted small">No rounds finished yet.</p>
        ) : (
          <table className="score-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Player</th>
                <th>Best</th>
                <th>Rounds</th>
              </tr>
            </thead>
            <tbody>
              {board.map((p, i) => (
                <tr key={p.user_id}>
                  <td>{best.has(p.user_id) ? i + 1 : '–'}</td>
                  <td>
                    {p.avatar} {p.name}
                  </td>
                  <td>{best.has(p.user_id) ? formatDuration(best.get(p.user_id)!) : '—'}</td>
                  <td className="small muted">
                    {rounds
                      .filter((r) => r.hider_id === p.user_id)
                      .map((r) => `R${r.round}: ${formatDuration(r.seek_ms)} + ${Math.round(r.bonus_ms / 60000)}m`)
                      .join(', ') || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card row spread wrap">
        <b>Appearance</b>
        <ThemeToggle />
      </div>

      <div className="row">
        <Link className="btn block" href="/rules">
          📖 Rules
        </Link>
        <button
          className="btn block ghost"
          onClick={async () => {
            if (!confirm('Leave this game?')) return;
            await leaveGame(game, me).catch(() => {});
            window.location.href = '/';
          }}
        >
          🚪 Leave
        </button>
      </div>
    </div>
  );
}

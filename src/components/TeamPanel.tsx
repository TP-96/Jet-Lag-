'use client';

import { useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { boundaryArea, isValidBoundary } from '@/lib/game/geofence';
import { backToLobby, finishGame, leaveGame, resetGame, startRound, updateSettings } from '@/lib/actions';
import { standings } from '@/lib/game/scoring';
import { SIZES, formatDistance, formatDuration, type GameSize } from '@/lib/game/config';
import { useGameCtx, useNow } from './GameContext';
import ThemeToggle from './ThemeToggle';
import Icon from './Icon';
import type { CelebrationKind } from './Celebration';

const BoundaryEditor = dynamic(() => import('./BoundaryEditor'), { ssr: false });

export default function TeamPanel({ onCelebrate }: { onCelebrate: (k: CelebrationKind) => void }) {
  const { game, players, rounds, isHost, me, toast, locations, locStatus, position } = useGameCtx();
  const [editingArea, setEditingArea] = useState(false);
  const boundary = isValidBoundary(game.settings.boundary) ? game.settings.boundary : null;
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

  const between = game.status === 'lobby' || game.status === 'round_over';
  const timesHid = (n: number) => (n === 0 ? 'hasn’t hidden yet' : n === 1 ? 'hid once' : `hid ${n} times`);
  const locLabel =
    locStatus === 'active' ? 'Sharing' : locStatus === 'denied' ? 'Blocked in phone settings' : locStatus === 'prompt' ? 'Waiting for permission' : String(locStatus);

  return (
    <div className="lobby">
      {game.status !== 'finished' && (
        <button className="btn invite block" onClick={share}>
          <Icon name="share" />
          Invite friends to {game.code}
        </button>
      )}

      <section>
        <h2 className="group-title">Players ({players.length})</h2>
        <div className="group">
          {players.map((p) => {
            const loc = locations.find((l) => l.user_id === p.user_id);
            const online = now - new Date(loc?.updated_at ?? p.last_seen).getTime() < 120_000;
            const picking = isHost && between;
            const Row = picking ? 'button' : 'div';
            return (
              <Row
                key={p.user_id}
                className={`item player-item ${picking && chosen === p.user_id ? 'on' : ''}`}
                {...(picking ? { onClick: () => setHider(p.user_id), 'aria-pressed': chosen === p.user_id } : {})}
              >
                <span className="pin" style={{ background: p.color }}>
                  {p.avatar}
                </span>
                <span className="grow">
                  <b>
                    {p.name}
                    {p.user_id === me && <span className="muted"> (you)</span>}
                  </b>
                  <span className="muted small">
                    <span className="dot" style={{ background: online ? 'var(--ok)' : 'var(--line)' }} /> {online ? 'Online' : 'Offline'},{' '}
                    {timesHid(hidCount(p.user_id))}
                    {p.user_id === game.host_id && ', host'}
                  </span>
                </span>
                {game.status === 'finished' ? null : !between ? (
                  <span className={`tag ${game.hider_id === p.user_id ? 'hider' : 'seeker'}`}>{game.hider_id === p.user_id ? 'Hider' : 'Seeker'}</span>
                ) : picking ? (
                  <span className={`hider-pick ${chosen === p.user_id ? 'on' : ''}`}>{chosen === p.user_id ? 'Hides next' : 'Pick'}</span>
                ) : (
                  chosen === p.user_id && <span className="tag hider">Hides next</span>
                )}
              </Row>
            );
          })}
        </div>
        {isHost && between && <p className="group-foot">Tap a player to choose who hides next round.</p>}
      </section>

      <section>
        <h2 className="group-title">Game</h2>
        <div className="group">
          <div className="item">
            <span className="grow">
              <span className="muted small">Getting around</span>
              <span>{game.settings.transitRules}</span>
            </span>
          </div>
          <div className="item">
            <span className="grow">
              <span className="muted small">Play area</span>
              <span>
                {boundary
                  ? `${boundary.name}, ${(boundaryArea(boundary) / 1e6).toFixed(1)} km²`
                  : 'Anywhere. No boundary set.'}
              </span>
            </span>
            {isHost && between && (
              <button className="btn small" onClick={() => setEditingArea(true)}>
                {boundary ? 'Edit' : 'Set up'}
              </button>
            )}
          </div>
          <div className="item">
            <span className="grow">
              <span className="muted small">Your location</span>
              <span style={{ color: locStatus === 'denied' ? 'var(--danger)' : undefined }}>{locLabel}</span>
            </span>
            {typeof Notification !== 'undefined' && Notification.permission === 'default' && (
              <button className="btn small" onClick={() => Notification.requestPermission()}>
                Turn on alerts
              </button>
            )}
          </div>
        </div>
      </section>

      {editingArea && (
        <BoundaryEditor
          initial={boundary}
          here={position ? { lat: position.coords.latitude, lng: position.coords.longitude } : null}
          units={game.settings.units}
          onClose={() => setEditingArea(false)}
          onSave={async (b) => {
            setEditingArea(false);
            await updateSettings(game, { settings: { boundary: b } }).catch((e) => toast(e.message));
            toast(b ? `Play area set: ${b.name}` : 'Play area removed');
          }}
        />
      )}

      {between && isHost && (
        <section>
          <h2 className="group-title">Round {game.round + 1} settings</h2>
          <div className="group">
            <label className="item select-row">
              <span className="grow">
                <span>Size</span>
                <span className="muted small">
                  {SIZES[game.size].hidingMinutes} min to hide, {formatDistance(SIZES[game.size].zoneRadiusM, game.settings.units)} hiding zone
                </span>
              </span>
              <select value={game.size} onChange={(e) => updateSettings(game, { size: e.target.value as GameSize })}>
                {(Object.keys(SIZES) as GameSize[]).map((s) => (
                  <option key={s} value={s}>
                    {SIZES[s].label.split(' — ')[0]}
                  </option>
                ))}
              </select>
            </label>
            <label className="item select-row">
              <span className="grow">Time to answer</span>
              <select value={game.settings.answerMinutes} onChange={(e) => updateSettings(game, { settings: { answerMinutes: Number(e.target.value) } })}>
                {[3, 5, 7, 10].map((m) => (
                  <option key={m} value={m}>
                    {m} min
                  </option>
                ))}
              </select>
            </label>
            <label className="item toggle-row">
              <span className="grow">
                <span>Hider sees seekers</span>
                <span className="muted small">Makes it easier for the hider</span>
              </span>
              <input
                type="checkbox"
                role="switch"
                checked={game.settings.hiderSeesSeekers}
                onChange={(e) => updateSettings(game, { settings: { hiderSeesSeekers: e.target.checked } })}
              />
            </label>
            <label className="item stack" style={{ gap: 6 }}>
              <span className="muted small">Transit rules everyone sees</span>
              <textarea
                className="input"
                rows={2}
                defaultValue={game.settings.transitRules}
                onBlur={(e) => updateSettings(game, { settings: { transitRules: e.target.value } })}
              />
            </label>
          </div>
        </section>
      )}

      {game.status === 'finished' && (
        <section className="winner-panel">
          <span className="pin big" style={{ background: champion?.color ?? 'var(--line)' }}>
            {champion?.avatar ?? '–'}
          </span>
          <h2>{champion ? `${champion.name} wins` : 'Game over'}</h2>
          {champion && <p className="muted">Longest hide: {formatDuration(best.get(champion.user_id)!)}</p>}
          <button className="btn block" onClick={() => onCelebrate('winner')}>
            Watch the finale again
          </button>
          {isHost && (
            <button className="btn primary block" onClick={() => confirm('Start a new game with the same players? Scores reset.') && resetGame(game).catch((e) => toast(e.message))}>
              Play again
            </button>
          )}
        </section>
      )}

      <section>
        <h2 className="group-title">Leaderboard</h2>
        {rounds.length === 0 ? (
          <p className="group-foot" style={{ marginTop: 0 }}>
            Nobody has been found yet. Your score is how long you stay hidden, plus any time-bonus cards you’re holding.
          </p>
        ) : (
          <ol className="group board-list">
            {board.map((p, i) => (
              <li key={p.user_id} className="item">
                <span className="place">{best.has(p.user_id) ? i + 1 : '–'}</span>
                <span className="pin" style={{ background: p.color }}>
                  {p.avatar}
                </span>
                <span className="grow">
                  <b>{p.name}</b>
                  <span className="muted small">
                    {rounds
                      .filter((r) => r.hider_id === p.user_id)
                      .map((r) => `Round ${r.round}: ${formatDuration(r.total_ms)}`)
                      .join(', ') || 'Hasn’t hidden yet'}
                  </span>
                </span>
                <span className="time">{best.has(p.user_id) ? formatDuration(best.get(p.user_id)!) : ''}</span>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section>
        <div className="group">
          <div className="item row spread">
            <span>Appearance</span>
            <ThemeToggle />
          </div>
          <Link className="item link-row" href="/rules">
            <span className="grow">How to play</span>
            <span className="chev" aria-hidden>
              ›
            </span>
          </Link>
          <Link className="item link-row" href="/">
            <span className="grow">All my games</span>
            <span className="chev" aria-hidden>
              ›
            </span>
          </Link>
          <button
            className="item link-row danger-text"
            onClick={async () => {
              if (!confirm('Leave this game? You can rejoin later with the code.')) return;
              await leaveGame(game, me).catch(() => {});
              window.location.href = '/';
            }}
          >
            Leave game
          </button>
        </div>
      </section>

      {isHost && between && rounds.length > 0 && (
        <button
          className="btn ghost block"
          onClick={() => confirm('End the game and crown the winner?') && finishGame(game, champion?.name ?? null).catch((e) => toast(e.message))}
        >
          End the game and crown the winner
        </button>
      )}
      {game.status === 'round_over' && isHost && (
        <button className="btn ghost block" onClick={() => backToLobby(game)}>
          Back to lobby
        </button>
      )}

      {between && (
        <div className="sticky-action">
          {isHost ? (
            <button
              className="btn primary block big-action"
              disabled={!canStart || busy}
              onClick={async () => {
                setBusy(true);
                await startRound(game, players, chosen!).catch((e) => toast(e.message));
                setBusy(false);
              }}
            >
              {players.length < 2
                ? 'Waiting for at least 2 players'
                : `Start round ${game.round + 1}: ${players.find((p) => p.user_id === chosen)?.name ?? 'someone'} hides`}
            </button>
          ) : (
            <p className="waiting">Waiting for the host to start round {game.round + 1}…</p>
          )}
        </div>
      )}
    </div>
  );
}

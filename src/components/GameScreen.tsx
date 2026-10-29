'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { beginSeeking, joinGame, recordRound, saveHiderState } from '@/lib/actions';
import { SIZES } from '@/lib/game/config';
import { cardDef, handTimeBonus, newHiderState, type HiderState } from '@/lib/game/deck';
import { haversine } from '@/lib/game/geo';
import { loadProfile, rememberGame } from '@/lib/profile';
import { sounds, vibrate } from '@/lib/sounds';
import { supabase } from '@/lib/supabase';
import { useGame } from '@/lib/useGame';
import { useLocationSharing, useWakeLock } from '@/lib/useLocation';
import type { Message } from '@/lib/types';
import { GameContext, useNow, type GameCtx } from './GameContext';
import Chat from './Chat';
import QuestionsPanel from './QuestionsPanel';
import HiderCards from './HiderCards';
import CursesPanel from './CursesPanel';
import TeamPanel from './TeamPanel';
import StatusBar from './StatusBar';
import { DrawModal, OverLimitModal } from './DrawModal';
import { TrollOverlay, type TrollFx } from './TrollOverlay';

const MapView = dynamic(() => import('./MapView'), { ssr: false, loading: () => <div className="center muted">Loading map…</div> });

type Tab = 'map' | 'chat' | 'questions' | 'cards' | 'team';

function notify(title: string, body: string) {
  if (typeof document === 'undefined' || document.visibilityState === 'visible') return;
  if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    try {
      new Notification(title, { body, icon: '/icon.svg' });
    } catch {}
  }
}

export default function GameScreen({ code }: { code: string }) {
  const data = useGame(code);
  const { game, me, players, questions, messages, effects, rounds, hiderState } = data;
  const [tab, setTab] = useState<Tab>('team');
  const [toasts, setToasts] = useState<{ id: number; text: string }[]>([]);
  const [fx, setFx] = useState<TrollFx | null>(null);
  const [lastChatRead, setLastChatRead] = useState(() => Date.now());
  const [joining, setJoining] = useState(false);
  const now = useNow(1000);

  const myPlayer = players.find((p) => p.user_id === me);
  const isHider = !!game && !!me && game.hider_id === me && game.status !== 'lobby';
  const inRound = !!game && ['hiding', 'seeking', 'endgame'].includes(game.status);

  const { position, status: locStatus } = useLocationSharing(game?.id, me, !!myPlayer);
  useWakeLock(inRound);

  const toast = useCallback((text: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-3), { id, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 5000);
  }, []);

  // Auto-join with the saved profile when opening a shared link.
  useEffect(() => {
    if (data.loading || !game || !me || myPlayer || joining) return;
    const profile = loadProfile();
    if (!profile.name) {
      window.location.href = `/?join=${code}`;
      return;
    }
    setJoining(true);
    joinGame(code, profile)
      .then(() => data.reload())
      .catch((e) => toast(String(e.message ?? e)))
      .finally(() => setJoining(false));
  }, [data, game, me, myPlayer, joining, code, toast]);

  useEffect(() => {
    if (myPlayer) rememberGame(code);
  }, [myPlayer, code]);

  // Default tab follows the phase.
  const lastStatus = useRef<string | null>(null);
  useEffect(() => {
    if (!game || lastStatus.current === game.status) return;
    const prev = lastStatus.current;
    lastStatus.current = game.status;
    if (game.status === 'lobby' || game.status === 'round_over') setTab('team');
    else if (prev === null || prev === 'lobby' || prev === 'round_over') setTab('map');
    if (prev && game.status === 'seeking' && prev === 'hiding') {
      sounds.alarm();
      vibrate([300, 100, 300]);
    }
    if (prev && game.status === 'endgame') {
      sounds.alarm();
      vibrate([500, 200, 500, 200, 500]);
    }
  }, [game]);

  // ── hider state ──
  const hiderRef = useRef(hiderState);
  hiderRef.current = hiderState;
  const mutateHider = useCallback(
    async (fn: (s: HiderState) => HiderState) => {
      if (!game || !me || !hiderRef.current) return null;
      const next = fn(hiderRef.current.state);
      const row = { ...hiderRef.current, state: next, hand_count: next.hand.length };
      hiderRef.current = row;
      data.setHiderStateLocal(row);
      await saveHiderState(game, me, next);
      return next;
    },
    [game, me, data],
  );

  // Create the hider's deck at the start of their round (only if none exists yet).
  const initRound = useRef<number | null>(null);
  useEffect(() => {
    if (!game || !me || !isHider || data.loading || hiderState || game.status === 'round_over') return;
    if (initRound.current === game.round) return;
    initRound.current = game.round;
    (async () => {
      const { data: existing } = await supabase().from('hider_states').select('*').eq('game_id', game.id).eq('round', game.round).maybeSingle();
      if (existing) data.setHiderStateLocal(existing);
      else await saveHiderState(game, me, newHiderState());
      data.reload();
    })();
  }, [game, me, isHider, hiderState, data]);

  // Hiding timer → seeking (any client can flip it; the update is idempotent).
  const flipping = useRef(false);
  useEffect(() => {
    if (!game || game.status !== 'hiding' || !game.hide_started_at || flipping.current) return;
    const end = new Date(game.hide_started_at).getTime() + SIZES[game.size].hidingMinutes * 60_000;
    if (now >= end) {
      flipping.current = true;
      beginSeeking(game)
        .then(() => data.reload())
        .finally(() => (flipping.current = false));
    }
  }, [game, now, data]);

  // If the hider never set a zone, lock it where they stand when seeking begins.
  useEffect(() => {
    if (!isHider || !hiderState || hiderState.state.zone || !position) return;
    if (game?.status === 'seeking' || game?.status === 'endgame') {
      mutateHider((s) => ({ ...s, zone: { lat: position.coords.latitude, lng: position.coords.longitude, label: 'Auto-locked' } }));
      toast('📍 Hiding zone locked at your current position.');
    }
  }, [isHider, hiderState, position, game?.status, mutateHider, toast]);

  // Hider records the score (only they know their time bonus cards).
  useEffect(() => {
    if (!game || !isHider || game.status !== 'round_over' || !hiderState) return;
    if (rounds.some((r) => r.round === game.round)) return;
    recordRound(game, handTimeBonus(hiderState.state.hand, game.size)).catch(() => {});
  }, [game, isHider, hiderState, rounds]);

  // ── notifications ──
  const seen = useRef<{ q: Map<string, string>; e: Set<string>; m: Set<string>; ready: boolean }>({ q: new Map(), e: new Set(), m: new Set(), ready: false });
  const player = useCallback((id: string | null | undefined) => players.find((p) => p.user_id === id), [players]);

  const runTroll = useCallback(
    (m: Message) => {
      const action = (m.meta as { action?: string }).action;
      const from = player(m.user_id)?.name ?? 'Someone';
      switch (action) {
        case 'airhorn':
          sounds.airhorn();
          break;
        case 'trombone':
          sounds.sadTrombone();
          break;
        case 'ominous':
          sounds.curse();
          break;
        case 'buzz':
          vibrate([200, 80, 200, 80, 400]);
          break;
      }
      setFx({ id: m.id, action: action ?? 'buzz', from });
      setTimeout(() => setFx((f) => (f?.id === m.id ? null : f)), 2600);
    },
    [player],
  );

  useEffect(() => {
    if (data.loading || !me) return;
    const s = seen.current;
    if (!s.ready) {
      questions.forEach((q) => s.q.set(q.id, q.status));
      effects.forEach((e) => s.e.add(e.id));
      messages.forEach((m) => s.m.add(m.id));
      s.ready = true;
      return;
    }
    for (const q of questions) {
      const prev = s.q.get(q.id);
      if (prev === q.status) continue;
      s.q.set(q.id, q.status);
      if (!prev && q.status === 'pending' && q.round === game?.round) {
        if (isHider) {
          sounds.question();
          vibrate([200, 100, 200]);
          toast(`❓ New question: ${q.text}`);
          notify('New question!', q.text);
        } else if (q.asked_by !== me) toast(`❓ ${player(q.asked_by)?.name ?? 'A seeker'} asked: ${q.text}`);
      } else if (prev === 'pending' && q.status !== 'pending' && !isHider) {
        sounds.ding();
        vibrate(150);
        const a = q.status === 'vetoed' ? 'VETOED 🚫' : q.answer?.photo_url ? '📸 photo received' : q.answer?.value?.toUpperCase();
        toast(`✅ Answer: ${a}`);
        notify('Question answered', `${q.text} → ${a}`);
      }
    }
    for (const e of effects) {
      if (s.e.has(e.id)) continue;
      s.e.add(e.id);
      if (e.cast_by === me) continue;
      const d = cardDef(e.card_id);
      sounds.curse();
      vibrate([400, 100, 400]);
      toast(`${d.kind === 'curse' ? '💀' : '⚡'} ${d.name} played!`);
      notify(d.name, d.kind === 'curse' ? d.effect : 'The hider played a card');
    }
    for (const m of messages) {
      if (s.m.has(m.id)) continue;
      s.m.add(m.id);
      if (m.user_id === me) continue;
      const fresh = Date.now() - new Date(m.created_at).getTime() < 30_000;
      if (m.kind === 'troll' && fresh) runTroll(m);
      else if (m.kind !== 'system' && fresh && document.visibilityState !== 'visible') notify(player(m.user_id)?.name ?? 'Message', m.body ?? '📎');
    }
  }, [questions, effects, messages, data.loading, me, isHider, game?.round, toast, player, runTroll]);

  useEffect(() => {
    if (tab === 'chat') setLastChatRead(Date.now());
  }, [tab, messages.length]);

  const unread = useMemo(
    () => messages.filter((m) => m.user_id !== me && m.kind !== 'system' && new Date(m.created_at).getTime() > lastChatRead).length,
    [messages, me, lastChatRead],
  );
  const pendingQ = game ? questions.filter((q) => q.round === game.round && q.status === 'pending').length : 0;

  if (data.error) {
    return (
      <div className="center">
        <div className="stack">
          <p>{data.error}</p>
          <a className="btn" href="/">
            Back home
          </a>
        </div>
      </div>
    );
  }
  if (data.loading || !game || !me || !myPlayer) return <div className="center muted">{joining ? 'Joining…' : 'Loading game…'}</div>;

  const ctx: GameCtx = {
    ...data,
    game,
    me,
    myPlayer,
    isHider,
    isHost: game.host_id === me,
    position,
    locStatus,
    player,
    mutateHider,
    toast,
  };

  const zone = hiderState?.state.zone;
  const outsideZone =
    isHider && zone && position && (game.status === 'seeking' || game.status === 'endgame')
      ? haversine(zone, { lat: position.coords.latitude, lng: position.coords.longitude }) > SIZES[game.size].zoneRadiusM
      : false;
  const moving = game.move_until && new Date(game.move_until).getTime() > now;

  return (
    <GameContext.Provider value={ctx}>
      <div className={`shell ${fx?.action === 'buzz' ? 'shake' : ''}`}>
        <StatusBar now={now} />
        <div>
          {locStatus === 'denied' && <div className="banner danger">📍 Location blocked — enable it in your browser/app settings to be tracked.</div>}
          {isHider && game.status === 'hiding' && !zone && (
            <div className="banner warn">🚉 Get to a transit station, then set your hiding zone on the Map tab.</div>
          )}
          {outsideZone && <div className="banner danger">⚠️ You are outside your hiding zone! Get back inside.</div>}
          {isHider && game.status === 'endgame' && <div className="banner danger">🚨 ENDGAME — do not move!</div>}
          {moving && (
            <div className="banner info">
              🏃 Hider is MOVING — seekers must stay where they are.
            </div>
          )}
        </div>
        <div className="main">
          {tab === 'map' && (
            <div className="panel flush">
              <MapView />
            </div>
          )}
          {tab === 'chat' && (
            <div className="panel flush">
              <Chat />
            </div>
          )}
          {tab === 'questions' && (
            <div className="panel">
              <QuestionsPanel />
            </div>
          )}
          {tab === 'cards' && <div className="panel">{isHider ? <HiderCards /> : <CursesPanel />}</div>}
          {tab === 'team' && (
            <div className="panel">
              <TeamPanel />
            </div>
          )}
        </div>
        <nav className="tabs">
          {(
            [
              ['map', '🗺️', 'Map', 0],
              ['chat', '💬', 'Chat', unread],
              ['questions', '❓', isHider ? 'Answer' : 'Ask', pendingQ],
              ['cards', isHider ? '🃏' : '💀', isHider ? 'Cards' : 'Curses', effects.filter((e) => e.round === game.round && !e.cleared_at).length],
              ['team', '👥', game.status === 'lobby' ? 'Lobby' : 'Team', 0],
            ] as [Tab, string, string, number][]
          ).map(([id, ic, label, badge]) => (
            <button key={id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>
              <span className="ic">{ic}</span>
              {label}
              {badge > 0 && tab !== id && <span className="badge">{badge}</span>}
            </button>
          ))}
        </nav>
      </div>
      <div className="toasts">
        {toasts.map((t) => (
          <div key={t.id} className="toast" onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))}>
            {t.text}
          </div>
        ))}
      </div>
      {isHider && hiderState?.state.pending && <DrawModal />}
      {isHider && hiderState && !hiderState.state.pending && hiderState.state.hand.length > hiderState.state.handLimit && <OverLimitModal />}
      <TrollOverlay fx={fx} />
    </GameContext.Provider>
  );
}

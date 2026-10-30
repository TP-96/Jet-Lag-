'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { ensureUser, supabase } from './supabase';
import type { Effect, Game, HiderStateRow, Message, Player, PlayerLocation, Question, Reaction, RoundResult } from './types';

function upsertBy<T extends object>(list: T[], row: T, keys: (keyof T)[]): T[] {
  const i = list.findIndex((r) => keys.every((k) => r[k] === row[k]));
  if (i === -1) return [...list, row];
  const copy = [...list];
  copy[i] = row;
  return copy;
}

function removeBy<T extends object>(list: T[], row: Partial<T>, keys: (keyof T)[]): T[] {
  return list.filter((r) => !keys.every((k) => r[k] === row[k]));
}

export interface GameData {
  me: string | null;
  game: Game | null;
  players: Player[];
  locations: PlayerLocation[];
  messages: Message[];
  reactions: Reaction[];
  questions: Question[];
  effects: Effect[];
  rounds: RoundResult[];
  hiderState: HiderStateRow | null;
  error: string | null;
  loading: boolean;
  /** Realtime connection is up. When false the hook polls instead. */
  live: boolean;
  /** Ephemeral broadcast channel for trolling (air horns, buzzes, typing). */
  channel: RealtimeChannel | null;
  reload: () => Promise<void>;
  setHiderStateLocal: (row: HiderStateRow) => void;
}

export function useGame(code: string): GameData {
  const [me, setMe] = useState<string | null>(null);
  const [game, setGame] = useState<Game | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [locations, setLocations] = useState<PlayerLocation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [effects, setEffects] = useState<Effect[]>([]);
  const [rounds, setRounds] = useState<RoundResult[]>([]);
  const [hiderState, setHiderState] = useState<HiderStateRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [channel, setChannel] = useState<RealtimeChannel | null>(null);
  const [live, setLive] = useState(false);
  const gameIdRef = useRef<string | null>(null);

  const loadAll = useCallback(async (gameId: string) => {
    const sb = supabase();
    const [g, p, l, m, r, q, e, rd, h] = await Promise.all([
      sb.from('games').select('*').eq('id', gameId).single(),
      sb.from('players').select('*').eq('game_id', gameId).order('joined_at'),
      sb.from('locations').select('*').eq('game_id', gameId),
      sb.from('messages').select('*').eq('game_id', gameId).order('created_at', { ascending: false }).limit(300),
      sb.from('reactions').select('*').eq('game_id', gameId),
      sb.from('questions').select('*').eq('game_id', gameId).order('asked_at'),
      sb.from('effects').select('*').eq('game_id', gameId).order('cast_at'),
      sb.from('rounds').select('*').eq('game_id', gameId).order('round'),
      sb.from('hider_states').select('*').eq('game_id', gameId),
    ]);
    if (g.data) setGame(g.data as Game);
    setPlayers((p.data ?? []) as Player[]);
    setLocations((l.data ?? []) as PlayerLocation[]);
    setMessages(((m.data ?? []) as Message[]).reverse());
    setReactions((r.data ?? []) as Reaction[]);
    setQuestions((q.data ?? []) as Question[]);
    setEffects((e.data ?? []) as Effect[]);
    setRounds((rd.data ?? []) as RoundResult[]);
    const rows = (h.data ?? []) as HiderStateRow[];
    const round = (g.data as Game | null)?.round;
    setHiderState(rows.find((x) => x.round === round) ?? null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let ch: RealtimeChannel | null = null;
    (async () => {
      try {
        const uid = await ensureUser();
        if (cancelled) return;
        setMe(uid);
        const sb = supabase();
        const { data: g, error: ge } = await sb.from('games').select('*').eq('code', code.toUpperCase()).maybeSingle();
        if (ge) throw ge;
        if (!g) throw new Error(`No game with code ${code.toUpperCase()}`);
        gameIdRef.current = g.id;

        const filter = `game_id=eq.${g.id}`;
        ch = sb.channel(`game:${g.id}`, { config: { broadcast: { self: false } } });
        ch.on('postgres_changes', { event: '*', schema: 'public', table: 'games', filter: `id=eq.${g.id}` }, (pl) => {
          if (pl.eventType !== 'DELETE') setGame(pl.new as Game);
        })
          .on('postgres_changes', { event: '*', schema: 'public', table: 'players', filter }, (pl) => {
            if (pl.eventType === 'DELETE') setPlayers((s) => removeBy(s, pl.old as Player, ['game_id', 'user_id']));
            else setPlayers((s) => upsertBy(s, pl.new as Player, ['game_id', 'user_id']));
          })
          .on('postgres_changes', { event: '*', schema: 'public', table: 'locations', filter }, (pl) => {
            if (pl.eventType === 'DELETE') setLocations((s) => removeBy(s, pl.old as PlayerLocation, ['user_id']));
            else setLocations((s) => upsertBy(s, pl.new as PlayerLocation, ['user_id']));
          })
          .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter }, (pl) => {
            if (pl.eventType === 'DELETE') setMessages((s) => removeBy(s, pl.old as Message, ['id']));
            else setMessages((s) => upsertBy(s, pl.new as Message, ['id']));
          })
          .on('postgres_changes', { event: '*', schema: 'public', table: 'reactions', filter }, (pl) => {
            if (pl.eventType === 'DELETE') setReactions((s) => removeBy(s, pl.old as Reaction, ['message_id', 'user_id', 'emoji']));
            else setReactions((s) => upsertBy(s, pl.new as Reaction, ['message_id', 'user_id', 'emoji']));
          })
          .on('postgres_changes', { event: '*', schema: 'public', table: 'questions', filter }, (pl) => {
            if (pl.eventType === 'DELETE') setQuestions((s) => removeBy(s, pl.old as Question, ['id']));
            else setQuestions((s) => upsertBy(s, pl.new as Question, ['id']));
          })
          .on('postgres_changes', { event: '*', schema: 'public', table: 'effects', filter }, (pl) => {
            if (pl.eventType === 'DELETE') setEffects((s) => removeBy(s, pl.old as Effect, ['id']));
            else setEffects((s) => upsertBy(s, pl.new as Effect, ['id']));
          })
          .on('postgres_changes', { event: '*', schema: 'public', table: 'rounds', filter }, (pl) => {
            if (pl.eventType !== 'DELETE') setRounds((s) => upsertBy(s, pl.new as RoundResult, ['round']));
          })
          .on('postgres_changes', { event: '*', schema: 'public', table: 'hider_states', filter }, (pl) => {
            if (pl.eventType !== 'DELETE') setHiderState(pl.new as HiderStateRow);
          })
          .subscribe((status) => {
            setLive(status === 'SUBSCRIBED');
            // Re-sync after (re)connecting so nothing missed while the phone slept is lost.
            if (status === 'SUBSCRIBED' && gameIdRef.current) loadAll(gameIdRef.current);
          });
        setChannel(ch);
        await loadAll(g.id);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    const onVisible = () => {
      if (document.visibilityState === 'visible' && gameIdRef.current) loadAll(gameIdRef.current);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      if (ch) supabase().removeChannel(ch);
    };
  }, [code, loadAll]);

  // Live state that matters second-to-second (clock, positions, questions, curses).
  const loadFast = useCallback(async (gameId: string) => {
    const sb = supabase();
    const [g, l, q, e] = await Promise.all([
      sb.from('games').select('*').eq('id', gameId).single(),
      sb.from('locations').select('*').eq('game_id', gameId),
      sb.from('questions').select('*').eq('game_id', gameId).order('asked_at'),
      sb.from('effects').select('*').eq('game_id', gameId).order('cast_at'),
    ]);
    if (g.data) setGame(g.data as Game);
    if (l.data) setLocations(l.data as PlayerLocation[]);
    if (q.data) setQuestions(q.data as Question[]);
    if (e.data) setEffects(e.data as Effect[]);
  }, []);

  // Realtime pushes changes instantly. If it drops (tunnels, flaky mobile data) poll the live state
  // every second and everything else every 5 s; while connected, a 30 s full sync is just a safety net.
  useEffect(() => {
    let tick = 0;
    let busy = false;
    const id = setInterval(async () => {
      const gid = gameIdRef.current;
      if (!gid || busy || document.visibilityState !== 'visible') return;
      tick++;
      busy = true;
      try {
        if (live) {
          if (tick % 30 === 0) await loadAll(gid);
        } else if (tick % 5 === 0) await loadAll(gid);
        else await loadFast(gid);
      } catch {
        // offline — try again next tick
      } finally {
        busy = false;
      }
    }, 1000);
    return () => clearInterval(id);
  }, [live, loadAll, loadFast]);

  // Keep only the current round's hider state.
  const currentHiderState = useMemo(
    () => (hiderState && game && hiderState.round === game.round && hiderState.user_id === me ? hiderState : null),
    [hiderState, game, me],
  );

  const reload = useCallback(async () => {
    if (gameIdRef.current) await loadAll(gameIdRef.current);
  }, [loadAll]);

  return {
    me,
    game,
    players,
    locations,
    messages,
    reactions,
    questions,
    effects,
    rounds,
    hiderState: currentHiderState,
    error,
    loading,
    live,
    channel,
    reload,
    setHiderStateLocal: setHiderState,
  };
}

'use client';

import { DEFAULT_SETTINGS, SIZES, type GameSettings, type GameSize } from './game/config';
import type { HiderState } from './game/deck';
import { ensureUser, supabase } from './supabase';
import type { Answer, Game, Message, Player, Question } from './types';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function randomCode(len = 5): string {
  const buf = new Uint32Array(len);
  crypto.getRandomValues(buf);
  return Array.from(buf, (n) => CODE_ALPHABET[n % CODE_ALPHABET.length]).join('');
}

function check<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

export interface Profile {
  name: string;
  avatar: string;
  color: string;
}

export async function createGame(opts: { name: string; size: GameSize; settings: Partial<GameSettings>; profile: Profile }): Promise<string> {
  const uid = await ensureUser();
  const sb = supabase();
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = randomCode();
    const res = await sb
      .from('games')
      .insert({ code, host_id: uid, name: opts.name, size: opts.size, settings: { ...DEFAULT_SETTINGS, ...opts.settings } })
      .select()
      .single();
    if (res.error?.code === '23505') continue; // code collision
    const game = check(res) as Game;
    check(await sb.from('players').insert({ game_id: game.id, user_id: uid, ...opts.profile }));
    await systemMessage(game.id, `${opts.profile.name} created the game. Share code ${code} with your friends!`);
    return code;
  }
  throw new Error('Could not allocate a game code, try again');
}

export async function joinGame(code: string, profile: Profile): Promise<void> {
  const uid = await ensureUser();
  const sb = supabase();
  const game = check(await sb.from('games').select('*').eq('code', code.toUpperCase()).maybeSingle()) as Game | null;
  if (!game) throw new Error(`No game with code ${code.toUpperCase()}`);
  const existing = check(await sb.from('players').select('user_id').eq('game_id', game.id).eq('user_id', uid).maybeSingle());
  if (existing) {
    check(await sb.from('players').update({ ...profile, last_seen: new Date().toISOString() }).eq('game_id', game.id).eq('user_id', uid));
    return;
  }
  check(await sb.from('players').insert({ game_id: game.id, user_id: uid, ...profile }));
  await systemMessage(game.id, `${profile.name} ${profile.avatar} joined the game.`);
}

export async function leaveGame(game: Game, uid: string) {
  check(await supabase().from('players').delete().eq('game_id', game.id).eq('user_id', uid));
}

export async function systemMessage(gameId: string, body: string, meta: Record<string, unknown> = {}, channel: 'all' | 'seekers' = 'all') {
  await supabase().from('messages').insert({ game_id: gameId, user_id: null, kind: 'system', body, meta, channel });
}

export async function sendMessage(
  msg: Pick<Message, 'game_id' | 'kind'> & Partial<Pick<Message, 'body' | 'media_url' | 'meta' | 'reply_to' | 'channel'>>,
) {
  const uid = await ensureUser();
  check(await supabase().from('messages').insert({ ...msg, user_id: uid }));
}

export async function deleteMessage(id: string) {
  check(await supabase().from('messages').delete().eq('id', id));
}

export async function toggleReaction(gameId: string, messageId: string, emoji: string, has: boolean) {
  const uid = await ensureUser();
  const sb = supabase();
  if (has) check(await sb.from('reactions').delete().match({ message_id: messageId, user_id: uid, emoji }));
  else check(await sb.from('reactions').insert({ game_id: gameId, message_id: messageId, user_id: uid, emoji }));
}

export async function updateSettings(game: Game, patch: Partial<Pick<Game, 'name' | 'size'>> & { settings?: Partial<GameSettings> }) {
  const { settings, ...rest } = patch;
  check(
    await supabase()
      .from('games')
      .update({ ...rest, ...(settings ? { settings: { ...game.settings, ...settings } } : {}) })
      .eq('id', game.id),
  );
}

export async function startRound(game: Game, players: Player[], hiderId: string) {
  const sb = supabase();
  const hider = players.find((p) => p.user_id === hiderId);
  check(await sb.from('players').update({ role: 'seeker' }).eq('game_id', game.id).neq('user_id', hiderId));
  check(await sb.from('players').update({ role: 'hider' }).eq('game_id', game.id).eq('user_id', hiderId));
  const round = game.round + 1;
  check(
    await sb
      .from('games')
      .update({
        status: 'hiding',
        round,
        hider_id: hiderId,
        hide_started_at: new Date().toISOString(),
        seek_started_at: null,
        endgame_at: null,
        found_at: null,
        move_until: null,
      })
      .eq('id', game.id),
  );
  const mins = SIZES[game.size].hidingMinutes;
  await systemMessage(game.id, `🏁 Round ${round} started! ${hider?.avatar ?? ''} ${hider?.name ?? 'The hider'} has ${mins} minutes to hide. Seekers: stay put!`, {
    event: 'round_start',
  });
}

/** Called by any client when the hiding timer runs out. Idempotent. */
export async function beginSeeking(game: Game) {
  if (game.status !== 'hiding' || !game.hide_started_at) return;
  const start = new Date(new Date(game.hide_started_at).getTime() + SIZES[game.size].hidingMinutes * 60_000);
  const res = await supabase()
    .from('games')
    .update({ status: 'seeking', seek_started_at: start.toISOString() })
    .eq('id', game.id)
    .eq('status', 'hiding')
    .select();
  if (res.data && res.data.length > 0) await systemMessage(game.id, '🔎 Hiding time is over — seekers, GO! The hider must now stay within their hiding zone.', { event: 'seek_start' });
}

export async function declareEndgame(game: Game, byName: string) {
  check(await supabase().from('games').update({ status: 'endgame', endgame_at: new Date().toISOString() }).eq('id', game.id).eq('status', 'seeking'));
  await systemMessage(game.id, `🚨 ENDGAME — ${byName}: the seekers are in the hiding zone and off transit. Hider: you must stay exactly where you are!`, { event: 'endgame' });
}

export async function markFound(game: Game, byName: string) {
  const res = await supabase()
    .from('games')
    .update({ status: 'round_over', found_at: new Date().toISOString() })
    .eq('id', game.id)
    .in('status', ['seeking', 'endgame'])
    .select();
  check(res);
  if (res.data && res.data.length > 0) await systemMessage(game.id, `🎯 FOUND! ${byName} tagged the hider.`, { event: 'found' });
}

export async function recordRound(game: Game, bonusMinutes: number) {
  if (!game.found_at || !game.seek_started_at || !game.hider_id) return;
  const seek_ms = new Date(game.found_at).getTime() - new Date(game.seek_started_at).getTime();
  const bonus_ms = bonusMinutes * 60_000;
  const sb = supabase();
  const existing = check(await sb.from('rounds').select('round').eq('game_id', game.id).eq('round', game.round).maybeSingle());
  if (existing) return;
  check(await sb.from('rounds').insert({ game_id: game.id, round: game.round, hider_id: game.hider_id, seek_ms, bonus_ms, total_ms: seek_ms + bonus_ms }));
}

export async function finishGame(game: Game, winnerName: string | null) {
  check(await supabase().from('games').update({ status: 'finished' }).eq('id', game.id).in('status', ['lobby', 'round_over']));
  await systemMessage(game.id, winnerName ? `👑 Game over! ${winnerName} is the champion!` : '🏁 Game over!', { event: 'finished' });
}

/** Start over with the same players: clears scores and round history. */
export async function resetGame(game: Game) {
  const sb = supabase();
  check(await sb.from('rounds').delete().eq('game_id', game.id));
  check(await sb.from('games').update({ status: 'lobby', round: 0, hider_id: null }).eq('id', game.id));
  await systemMessage(game.id, '🔄 New game! Scores have been reset.');
}

export async function backToLobby(game: Game) {
  check(await supabase().from('games').update({ status: 'lobby' }).eq('id', game.id));
}

export async function saveHiderState(game: Game, uid: string, state: HiderState) {
  check(
    await supabase()
      .from('hider_states')
      .upsert({ game_id: game.id, round: game.round, user_id: uid, state, hand_count: state.hand.length, updated_at: new Date().toISOString() }),
  );
}

export async function askQuestion(q: Omit<Question, 'id' | 'asked_at' | 'status' | 'answer' | 'answered_at' | 'asked_by'>) {
  const uid = await ensureUser();
  const row = check(await supabase().from('questions').insert({ ...q, asked_by: uid }).select().single()) as Question;
  return row;
}

export async function answerQuestion(q: Question, answer: Answer, status: Question['status'] = 'answered') {
  check(
    await supabase()
      .from('questions')
      .update({ answer, status, answered_at: new Date().toISOString() })
      .eq('id', q.id)
      .eq('status', 'pending'),
  );
}

export async function replaceQuestion(q: Question, patch: Partial<Question>) {
  check(await supabase().from('questions').update(patch).eq('id', q.id));
}

export async function castEffect(game: Game, cardId: string, endsAt: Date | null, note?: string) {
  const uid = await ensureUser();
  check(
    await supabase()
      .from('effects')
      .insert({ game_id: game.id, round: game.round, card_id: cardId, cast_by: uid, ends_at: endsAt?.toISOString() ?? null, note: note ?? null }),
  );
}

export async function clearEffect(id: string) {
  check(await supabase().from('effects').update({ cleared_at: new Date().toISOString() }).eq('id', id));
}

export async function setMoveUntil(game: Game, until: Date) {
  check(await supabase().from('games').update({ move_until: until.toISOString() }).eq('id', game.id));
}

export async function upsertLocation(gameId: string, uid: string, pos: GeolocationPosition) {
  await supabase()
    .from('locations')
    .upsert({
      game_id: gameId,
      user_id: uid,
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
      accuracy: pos.coords.accuracy,
      heading: pos.coords.heading,
      speed: pos.coords.speed,
      updated_at: new Date(pos.timestamp).toISOString(),
    });
}

export async function touchPlayer(gameId: string, uid: string) {
  await supabase().from('players').update({ last_seen: new Date().toISOString() }).eq('game_id', gameId).eq('user_id', uid);
}

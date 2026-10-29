import type { GameSettings, GameSize } from './game/config';
import type { HiderState } from './game/deck';

export type GameStatus = 'lobby' | 'hiding' | 'seeking' | 'endgame' | 'round_over' | 'finished';

export interface Game {
  id: string;
  code: string;
  host_id: string;
  name: string;
  size: GameSize;
  settings: GameSettings;
  status: GameStatus;
  round: number;
  hider_id: string | null;
  hide_started_at: string | null;
  seek_started_at: string | null;
  endgame_at: string | null;
  found_at: string | null;
  move_until: string | null;
  created_at: string;
}

export interface Player {
  game_id: string;
  user_id: string;
  name: string;
  color: string;
  avatar: string;
  role: 'hider' | 'seeker';
  joined_at: string;
  last_seen: string;
}

export interface PlayerLocation {
  game_id: string;
  user_id: string;
  lat: number;
  lng: number;
  accuracy: number | null;
  heading: number | null;
  speed: number | null;
  updated_at: string;
}

export type MessageKind = 'text' | 'image' | 'gif' | 'sticker' | 'troll' | 'system' | 'card' | 'location';

export interface Message {
  id: string;
  game_id: string;
  user_id: string | null;
  channel: 'all' | 'seekers';
  kind: MessageKind;
  body: string | null;
  media_url: string | null;
  meta: Record<string, unknown>;
  reply_to: string | null;
  created_at: string;
}

export interface Reaction {
  message_id: string;
  game_id: string;
  user_id: string;
  emoji: string;
}

export interface Answer {
  value?: string; // yes / no / closer / further / hotter / colder / free text
  photo_url?: string;
  vetoed?: boolean;
  randomized_from?: string;
  auto?: boolean;
  distance_m?: number;
}

export interface Question {
  id: string;
  game_id: string;
  round: number;
  question_id: string;
  category: string;
  text: string;
  distance_m: number | null;
  asked_by: string;
  asked_at: string;
  deadline: string;
  seeker_lat: number | null;
  seeker_lng: number | null;
  start_lat: number | null;
  start_lng: number | null;
  status: 'pending' | 'answered' | 'vetoed';
  answer: Answer | null;
  answered_at: string | null;
}

export interface Effect {
  id: string;
  game_id: string;
  round: number;
  card_id: string;
  cast_by: string;
  cast_at: string;
  ends_at: string | null;
  cleared_at: string | null;
  note: string | null;
}

export interface HiderStateRow {
  game_id: string;
  round: number;
  user_id: string;
  state: HiderState;
  hand_count: number;
  updated_at: string;
}

export interface RoundResult {
  game_id: string;
  round: number;
  hider_id: string;
  seek_ms: number;
  bonus_ms: number;
  total_ms: number;
  finished_at: string;
}

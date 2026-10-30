-- Jet Lag Hide + Seek — Supabase schema.
-- Run this once in the Supabase SQL editor (or `supabase db push`).
-- Requires: Authentication → Providers → "Anonymous sign-ins" enabled.

create extension if not exists pgcrypto;

-- ───────────────────────── tables ─────────────────────────

create table if not exists public.games (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  host_id uuid not null,
  name text not null default 'Hide + Seek',
  size text not null default 'small' check (size in ('small', 'medium', 'large')),
  settings jsonb not null default '{}'::jsonb,
  status text not null default 'lobby',
  round int not null default 0,
  hider_id uuid,
  hide_started_at timestamptz,
  seek_started_at timestamptz,
  endgame_at timestamptz,
  found_at timestamptz,
  move_until timestamptz,
  created_at timestamptz not null default now()
);

-- (Re)apply the status check so re-running this file upgrades older databases.
alter table public.games drop constraint if exists games_status_check;
alter table public.games add constraint games_status_check
  check (status in ('lobby', 'hiding', 'seeking', 'endgame', 'round_over', 'finished'));

create table if not exists public.players (
  game_id uuid not null references public.games (id) on delete cascade,
  user_id uuid not null,
  name text not null,
  color text not null default '#f43f5e',
  avatar text not null default '🧳',
  role text not null default 'seeker' check (role in ('hider', 'seeker')),
  joined_at timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  primary key (game_id, user_id)
);

create table if not exists public.locations (
  game_id uuid not null references public.games (id) on delete cascade,
  user_id uuid not null,
  lat double precision not null,
  lng double precision not null,
  accuracy double precision,
  heading double precision,
  speed double precision,
  updated_at timestamptz not null default now(),
  primary key (game_id, user_id)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games (id) on delete cascade,
  user_id uuid,
  channel text not null default 'all' check (channel in ('all', 'seekers')),
  kind text not null default 'text',
  body text,
  media_url text,
  meta jsonb not null default '{}'::jsonb,
  reply_to uuid,
  created_at timestamptz not null default now()
);
create index if not exists messages_game_created on public.messages (game_id, created_at);

create table if not exists public.reactions (
  message_id uuid not null references public.messages (id) on delete cascade,
  game_id uuid not null references public.games (id) on delete cascade,
  user_id uuid not null,
  emoji text not null,
  primary key (message_id, user_id, emoji)
);

create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games (id) on delete cascade,
  round int not null,
  question_id text not null,
  category text not null,
  text text not null,
  distance_m double precision,
  asked_by uuid not null,
  asked_at timestamptz not null default now(),
  deadline timestamptz not null,
  seeker_lat double precision,
  seeker_lng double precision,
  start_lat double precision,
  start_lng double precision,
  status text not null default 'pending' check (status in ('pending', 'answered', 'vetoed')),
  answer jsonb,
  answered_at timestamptz
);
create index if not exists questions_game_round on public.questions (game_id, round);

-- Active curses and other played cards visible to everyone.
create table if not exists public.effects (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games (id) on delete cascade,
  round int not null,
  card_id text not null,
  cast_by uuid not null,
  cast_at timestamptz not null default now(),
  ends_at timestamptz,
  cleared_at timestamptz,
  note text
);

-- The hider's private deck & hand. Only the hider can read it.
create table if not exists public.hider_states (
  game_id uuid not null references public.games (id) on delete cascade,
  round int not null,
  user_id uuid not null,
  state jsonb not null,
  hand_count int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (game_id, round)
);

create table if not exists public.rounds (
  game_id uuid not null references public.games (id) on delete cascade,
  round int not null,
  hider_id uuid not null,
  seek_ms bigint not null,
  bonus_ms bigint not null default 0,
  total_ms bigint not null,
  finished_at timestamptz not null default now(),
  primary key (game_id, round)
);

-- ───────────────────────── helpers ─────────────────────────

create or replace function public.is_member(g uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from players where game_id = g and user_id = auth.uid());
$$;

create or replace function public.is_hider(g uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from games where id = g and hider_id = auth.uid());
$$;

-- Hider location stays secret from seekers until the round is over.
-- Seekers' locations are hidden from the hider unless the game enables hiderSeesSeekers.
create or replace function public.can_see_location(g uuid, owner uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_member(g) and (
    owner = auth.uid()
    or exists (
      select 1 from games gm where gm.id = g and (
        gm.status in ('lobby', 'round_over', 'finished')
        or (
          owner is distinct from gm.hider_id
          and (auth.uid() is distinct from gm.hider_id or coalesce((gm.settings ->> 'hiderSeesSeekers')::boolean, false))
        )
      )
    )
  );
$$;

-- ───────────────────────── row level security ─────────────────────────

alter table public.games enable row level security;
alter table public.players enable row level security;
alter table public.locations enable row level security;
alter table public.messages enable row level security;
alter table public.reactions enable row level security;
alter table public.questions enable row level security;
alter table public.effects enable row level security;
alter table public.hider_states enable row level security;
alter table public.rounds enable row level security;

-- Games can be looked up by code so people can join.
drop policy if exists games_select on public.games;
create policy games_select on public.games for select to authenticated using (true);
drop policy if exists games_insert on public.games;
create policy games_insert on public.games for insert to authenticated with check (host_id = auth.uid());
drop policy if exists games_update on public.games;
create policy games_update on public.games for update to authenticated using (public.is_member(id));
drop policy if exists games_delete on public.games;
create policy games_delete on public.games for delete to authenticated using (host_id = auth.uid());

drop policy if exists players_select on public.players;
create policy players_select on public.players for select to authenticated using (public.is_member(game_id) or user_id = auth.uid());
drop policy if exists players_insert on public.players;
create policy players_insert on public.players for insert to authenticated with check (user_id = auth.uid());
drop policy if exists players_update on public.players;
create policy players_update on public.players for update to authenticated using (public.is_member(game_id));
drop policy if exists players_delete on public.players;
create policy players_delete on public.players for delete to authenticated
  using (user_id = auth.uid() or exists (select 1 from games where id = game_id and host_id = auth.uid()));

drop policy if exists locations_select on public.locations;
create policy locations_select on public.locations for select to authenticated using (public.can_see_location(game_id, user_id));
drop policy if exists locations_upsert on public.locations;
create policy locations_upsert on public.locations for insert to authenticated with check (user_id = auth.uid() and public.is_member(game_id));
drop policy if exists locations_update on public.locations;
create policy locations_update on public.locations for update to authenticated using (user_id = auth.uid());

-- The seekers-only channel is hidden from the current hider.
drop policy if exists messages_select on public.messages;
create policy messages_select on public.messages for select to authenticated
  using (public.is_member(game_id) and (channel = 'all' or not public.is_hider(game_id)));
drop policy if exists messages_insert on public.messages;
create policy messages_insert on public.messages for insert to authenticated
  with check (public.is_member(game_id) and (user_id = auth.uid() or user_id is null)
              and (channel = 'all' or not public.is_hider(game_id)));
drop policy if exists messages_delete on public.messages;
create policy messages_delete on public.messages for delete to authenticated using (user_id = auth.uid());

drop policy if exists reactions_select on public.reactions;
create policy reactions_select on public.reactions for select to authenticated using (public.is_member(game_id));
drop policy if exists reactions_insert on public.reactions;
create policy reactions_insert on public.reactions for insert to authenticated with check (user_id = auth.uid() and public.is_member(game_id));
drop policy if exists reactions_delete on public.reactions;
create policy reactions_delete on public.reactions for delete to authenticated using (user_id = auth.uid());

drop policy if exists questions_all on public.questions;
create policy questions_all on public.questions for all to authenticated using (public.is_member(game_id)) with check (public.is_member(game_id));

drop policy if exists effects_all on public.effects;
create policy effects_all on public.effects for all to authenticated using (public.is_member(game_id)) with check (public.is_member(game_id));

drop policy if exists rounds_all on public.rounds;
create policy rounds_all on public.rounds for all to authenticated using (public.is_member(game_id)) with check (public.is_member(game_id));

drop policy if exists hider_states_own on public.hider_states;
create policy hider_states_own on public.hider_states for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid() and public.is_member(game_id));

-- ───────────────────────── realtime ─────────────────────────

do $$
declare t text;
begin
  foreach t in array array['games', 'players', 'locations', 'messages', 'reactions', 'questions', 'effects', 'rounds', 'hider_states'] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;

-- ───────────────────────── storage (photos in chat & photo answers) ─────────────────────────

insert into storage.buckets (id, name, public) values ('media', 'media', true) on conflict (id) do nothing;

drop policy if exists media_upload on storage.objects;
create policy media_upload on storage.objects for insert to authenticated with check (bucket_id = 'media');
drop policy if exists media_read on storage.objects;
create policy media_read on storage.objects for select using (bucket_id = 'media');

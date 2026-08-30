-- Thirteen — schema for the Supabase/Postgres persistence layer.
-- Run in the Supabase SQL editor (or any Postgres). The game server also
-- creates these tables automatically at startup (CREATE TABLE IF NOT EXISTS),
-- so running this file is optional — useful for reviewing or locking down
-- permissions first.

-- Guest player identities, keyed by the browser's stable sid.
create table if not exists players (
	sid text primary key,
	name text not null,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);

-- Live room snapshots: one row per room, updated after every play/pass.
-- `state` is the authoritative engine GameState; `seats` carries the minimal
-- seat bookkeeping (name, sid, bot flag, last action seq) needed to resume.
create table if not exists rooms (
	code text primary key,
	password_hash text not null default '',
	state jsonb,
	seats jsonb not null default '[]'::jsonb,
	updated_at timestamptz not null default now()
);

-- One row per completed game — the basis for stats/history.
create table if not exists games (
	id bigint generated always as identity primary key,
	room_code text not null,
	scores jsonb not null,
	winner text not null,
	finished_at timestamptz not null default now()
);

create index if not exists games_room_code_idx on games (room_code, finished_at);

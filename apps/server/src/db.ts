import type { GameState } from '@thirteen/engine';

import postgres from 'postgres';

/**
 * Optional Postgres persistence, aimed at Supabase (any DATABASE_URL works).
 * Unset DATABASE_URL keeps the server fully in-memory — local dev, tests and
 * CI never touch a database. Every helper degrades to a no-op and persistence
 * failures never break gameplay: the in-memory room stays authoritative.
 */

let sql: postgres.Sql | null = null;
let ensured: Promise<void> | null = null;

function client(): postgres.Sql | null {
	if (sql !== null) return sql;
	const url = process.env.DATABASE_URL;
	if (!url) return null;
	sql = postgres(url, { max: 5, idle_timeout: 20 });
	return sql;
}

/** Creates the tables if they do not exist yet (idempotent, once per process). */
export async function ensureSchema(): Promise<void> {
	const db = client();
	if (!db) return;
	if (!ensured) {
		ensured = (async () => {
			await db.unsafe(`
				create table if not exists players (
					sid text primary key,
					name text not null,
					created_at timestamptz not null default now(),
					updated_at timestamptz not null default now()
				);
				create table if not exists rooms (
					code text primary key,
					password_hash text not null default '',
					state jsonb,
					seats jsonb not null default '[]'::jsonb,
					updated_at timestamptz not null default now()
				);
				create table if not exists games (
					id bigint generated always as identity primary key,
					room_code text not null,
					scores jsonb not null,
					winner text not null,
					finished_at timestamptz not null default now()
				);
			`);
		})().catch((err) => {
			ensured = null;
			throw err;
		});
	}
	return ensured;
}

export interface PersistedSeat {
	name: string;
	sid: string;
	bot: boolean;
	lastSeq: number;
}

export interface PersistedRoom {
	passwordHash: string;
	state: GameState | null;
	seats: (PersistedSeat | null)[];
}

export async function upsertPlayer(sid: string, name: string): Promise<void> {
	const db = client();
	if (!db || !sid) return;
	try {
		await ensureSchema();
		await db`
			insert into players (sid, name) values (${sid}, ${name})
			on conflict (sid) do update set name = excluded.name, updated_at = now()
		`;
	} catch (err) {
		console.warn('[db] player upsert failed:', err);
	}
}

export async function saveRoomState(code: string, room: PersistedRoom): Promise<void> {
	const db = client();
	if (!db) return;
	try {
		await ensureSchema();
		await db`
			insert into rooms (code, password_hash, state, seats, updated_at)
			values (${code}, ${room.passwordHash}, ${JSON.stringify(room.state)}::jsonb, ${JSON.stringify(room.seats)}::jsonb, now())
			on conflict (code) do update set
				password_hash = excluded.password_hash,
				state = excluded.state,
				seats = excluded.seats,
				updated_at = now()
		`;
	} catch (err) {
		console.warn('[db] room save failed:', err);
	}
}

export async function loadRoomState(code: string): Promise<PersistedRoom | null> {
	const db = client();
	if (!db) return null;
	try {
		await ensureSchema();
		const rows = await db`
			select password_hash, state, seats from rooms where code = ${code} limit 1
		`;
		const row = rows[0];
		if (!row) return null;
		return {
			passwordHash: String(row.password_hash ?? ''),
			state: (row.state as GameState | null) ?? null,
			seats: (row.seats as (PersistedSeat | null)[]) ?? []
		};
	} catch (err) {
		console.warn('[db] room load failed:', err);
		return null;
	}
}

export async function deleteRoomState(code: string): Promise<void> {
	const db = client();
	if (!db) return;
	try {
		await db`delete from rooms where code = ${code}`;
	} catch (err) {
		console.warn('[db] room delete failed:', err);
	}
}

export async function recordGame(
	code: string,
	scores: number[],
	winner: number | null
): Promise<void> {
	const db = client();
	if (!db) return;
	try {
		await ensureSchema();
		await db`
			insert into games (room_code, scores, winner)
			values (${code}, ${JSON.stringify(scores)}::jsonb, ${String(winner)})
		`;
	} catch (err) {
		console.warn('[db] game record failed:', err);
	}
}

/** Test/driver accessor: closes the pool (no-op without DATABASE_URL). */
export async function closeDb(): Promise<void> {
	if (sql) {
		await sql.end();
		sql = null;
		ensured = null;
	}
}

/** Number of completed games recorded for a room (stats/tests). */
export async function countGames(code: string): Promise<number> {
	const db = client();
	if (!db) return 0;
	try {
		const rows = await db`select count(*)::int as n from games where room_code = ${code}`;
		return rows[0]?.n ?? 0;
	} catch (err) {
		console.warn('[db] game count failed:', err);
		return 0;
	}
}

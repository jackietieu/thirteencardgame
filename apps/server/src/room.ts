import { createHash } from 'node:crypto';
import { greedyBot } from '@thirteen/bots';
import {
	applyMove,
	createGame,
	nextHand,
	viewForSeat,
	type Action,
	type GameState
} from '@thirteen/engine';
import type { SeatView, ServerMessage } from '@thirteen/protocol';
import { loadRoomState, recordGame, saveRoomState, upsertPlayer, type PersistedSeat } from './db.js';

/** Names handed to server-driven bots as they fill seats. */
const BOT_NAMES = ['Hùng', 'Lan', 'Mai', 'Tuấn', 'Smith', 'Johnson', 'Williams', 'Brown'];

export interface SeatConn {
	send(msg: ServerMessage): void;
}

interface Seat {
	name: string;
	sid: string;
	/** null while the seat is a server-driven bot. */
	conn: SeatConn | null;
	bot: boolean;
	lastSeq: number;
	takeoverTimer: ReturnType<typeof setTimeout> | undefined;
}

export interface RoomOptions {
	code: string;
	/** Optional lobby password — new joiners must repeat it (sid reclaim is exempt). */
	password?: string;
	/** Delay before a bot acts (lets humans watch the trick develop). */
	botDelayMs?: number;
	/** How long a dropped human keeps the seat before a bot takes over. */
	disconnectGraceMs?: number;
	seed?: number;
}

/** Rejected non-action requests (e.g. wrong lobby password). */
export class RoomError extends Error {
	constructor(public code: string) {
		super(code);
	}
}

const mod4 = (n: number) => ((n % 4) + 4) % 4;

function sha256(input: string): string {
	return createHash('sha256').update(input).digest('hex');
}

/**
 * One game room: an authoritative engine state plus up to four seats. Humans
 * connect over WS; empty seats are filled with bots when the host starts.
 * All engine rules are enforced here — the client is a display, never a judge.
 * State and seats persist to Postgres when DATABASE_URL is set, so refreshes
 * and server restarts resume the same game.
 */
export class Room {
	readonly code: string;
	/** sha256 of the lobby password, or '' when the room is open. */
	passwordHash = '';
	/** null until the host starts the game. */
	state: GameState | null = null;
	/** Global action counter — monotonic, sent with every snapshot. */
	seq = 0;
	private seats: (Seat | null)[] = [null, null, null, null];
	private botDelayMs: number;
	private disconnectGraceMs: number;
	private seed: number | undefined;
	private botTimer: ReturnType<typeof setTimeout> | undefined;
	private closed = false;
	/** Hand whose game-over result was already written to the database. */
	private recordedHand = -1;
	/** Serializes snapshot writes so an older payload never lands last. */
	private persistTail: Promise<void> = Promise.resolve();

	constructor(options: RoomOptions) {
		this.code = options.code;
		this.passwordHash = options.password ? sha256(options.password) : '';
		this.botDelayMs = options.botDelayMs ?? 500;
		this.disconnectGraceMs = options.disconnectGraceMs ?? 60_000;
		this.seed = options.seed;
	}
	/** Seats with a live connection (bots excluded). */
	private liveHumanCount(): number {
		return this.seats.filter((s) => s !== null && !s.bot && s.conn !== null).length;
	}

	isEmpty(): boolean {
		return this.liveHumanCount() === 0;
	}

	/** True if `sid` belongs to a seat in this room (reconnect support). */
	hasSid(sid: string): boolean {
		return this.seats.some((s) => s !== null && s.sid === sid);
	}

	phase(): 'lobby' | 'playing' {
		return this.state === null ? 'lobby' : 'playing';
	}

	lobbyMessage(seat: number): ServerMessage {
		return {
			t: 'lobby',
			room: this.code,
			players: this.seats.map((s) => s?.name ?? ''),
			bots: this.seats.map((s) => s?.bot ?? false),
			seat,
			hostSeat: this.hostSeat(),
			phase: 'lobby'
		};
	}

	private hostSeat(): number {
		const idx = this.seats.findIndex((s) => s !== null && !s.bot);
		return idx === -1 ? -1 : idx;
	}

	private stateMessage(seat: number): ServerMessage {
		const s = this.seats[seat]!;
		return {
			t: 'state',
			seq: this.seq,
			seat,
			// Rotate so the recipient renders themselves at the bottom.
			seatNames: Array.from({ length: 4 }, (_, d) => this.seats[mod4(d + seat)]?.name ?? ''),
			state: viewForSeat(this.state!, seat) as SeatView
		};
	}

	private broadcastState() {
		this.eachHuman((seat, conn) => conn.send(this.stateMessage(seat)));
		this.persist();
		this.recordGameIfOver();
	}

	/** Lobby snapshot to every connected human (seat order changed). */
	private broadcastLobby() {
		this.eachHuman((seat, conn) => conn.send(this.lobbyMessage(seat)));
	}

	/** Fire-and-forget room snapshot — refreshes and restarts resume from it.
	 *  The payload is captured synchronously; writes are chained so an older
	 *  snapshot can never overwrite a newer one. */
	private persist() {
		const seats = this.seats.map((s): PersistedSeat | null =>
			s ? { name: s.name, sid: s.sid, bot: s.bot, lastSeq: s.lastSeq } : null
		);
		const payload = { passwordHash: this.passwordHash, state: this.state, seats };
		this.persistTail = this.persistTail.then(
			() => saveRoomState(this.code, payload),
			() => saveRoomState(this.code, payload)
		);
	}

	/** Writes one row per completed game (deduped per hand). */
	private recordGameIfOver() {
		if (!this.state || this.state.phase !== 'gameOver' || this.recordedHand === this.state.handNumber) return;
		this.recordedHand = this.state.handNumber;
		void recordGame(this.code, this.state.scores, this.state.winner);
	}

	/**
	 * Rebuilds a room from its persisted snapshot (Postgres). Used when a
	 * player joins a room the server no longer has in memory — e.g. after a
	 * restart. Seats without a live connection re-arm their takeover timer.
	 */
	static async restore(code: string): Promise<Room | null> {
		const row = await loadRoomState(code);
		if (!row) return null;
		const room = new Room({ code });
		room.passwordHash = row.passwordHash;
		if (row.state && (row.state as GameState).phase) {
			room.state = row.state as GameState;
			if (room.state.phase === 'gameOver') room.recordedHand = room.state.handNumber;
		}
		room.seats = Array.from({ length: 4 }, (_, i) => {
			const s = row.seats[i];
			return s
				? { name: s.name, sid: s.sid, conn: null, bot: s.bot, lastSeq: s.lastSeq, takeoverTimer: undefined }
				: null;
		});
		for (let seat = 0; seat < 4; seat++) room.armTakeover(seat);
		room.scheduleBot();
		return room;
	}

	/** Starts the grace timer for a human seat whose connection dropped. */
	private armTakeover(seat: number) {
		const s = this.seats[seat];
		if (!s || s.bot || s.conn !== null || this.state === null || s.takeoverTimer !== undefined) return;
		s.takeoverTimer = setTimeout(() => {
			s.takeoverTimer = undefined;
			if (s.conn !== null) return; // came back in time
			s.bot = true;
			s.name = BOT_NAMES[seat % BOT_NAMES.length]!;
			this.broadcastEvent('botTakeover', seat);
			this.broadcastState();
			this.scheduleBot();
		}, this.disconnectGraceMs);
	}


	private broadcastEvent(
		name: 'played' | 'passed' | 'nextHand' | 'seatLeft' | 'botTakeover',
		roomSeat: number,
		action?: Action
	) {
		this.eachHuman((seat, conn) => {
			conn.send({
				t: 'event',
				name,
				seat: roomSeat === -1 ? -1 : mod4(roomSeat - seat),
				handNumber: this.state?.handNumber ?? 0,
				action
			});
		});
	}

	private eachHuman(fn: (seat: number, conn: SeatConn) => void) {
		if (this.closed) return;
		for (let seat = 0; seat < 4; seat++) {
			const s = this.seats[seat];
			if (s && !s.bot && s.conn !== null) fn(seat, s.conn);
		}
	}

	/**
	 * Attaches a human. Rejoins by `sid` reclaim the same seat (mid-game reload);
	 * otherwise the first open seat is assigned — gated by the lobby password.
	 * Returns the seat, or null when the room is full.
	 */
	join(name: string, sid: string, conn: SeatConn, password?: string): number | null {
		const existing = this.seats.findIndex((s) => s !== null && s.sid === sid);
		if (existing !== -1) {
			const s = this.seats[existing]!;
			s.name = name || s.name;
			s.conn = conn;
			s.bot = false;
			// The client is fresh (reload): its action counter restarted at 1,
			// so the persisted lastSeq would silently drop every new action.
			s.lastSeq = 0;
			if (s.takeoverTimer !== undefined) {
				clearTimeout(s.takeoverTimer);
				s.takeoverTimer = undefined;
			}
			this.deliver(existing, conn);
			this.persist();
			return existing;
		}
		// The room creator (first seat into an empty room) is exempt: they set the password.
		if (this.passwordHash !== '' && this.seats.some((s) => s !== null) && (!password || sha256(password) !== this.passwordHash)) {
			throw new RoomError('bad_password');
		}
		const open = this.seats.findIndex((s) => s === null);
		if (open === -1) return null;
		this.seats[open] = { name, sid, conn, bot: false, lastSeq: 0, takeoverTimer: undefined };
		this.deliver(open, conn);
		void upsertPlayer(sid, name);
		this.persist();
		return open;
	}

	/** Sends whatever snapshot matches the room's current phase. */
	private deliver(seat: number, conn: SeatConn) {
		if (this.state === null) conn.send(this.lobbyMessage(seat));
		else conn.send(this.stateMessage(seat));
	}

	/** Detaches a connection. If it was a human's last link, the grace timer runs. */
	disconnect(conn: SeatConn) {
		for (let seat = 0; seat < 4; seat++) {
			const s = this.seats[seat];
			if (!s || s.conn !== conn) continue;
			s.conn = null;
			if (this.state !== null && !s.bot) {
				this.broadcastEvent('seatLeft', seat);
				this.persist();
				this.armTakeover(seat);
			}
		}
	}

	leave(conn: SeatConn) {
		for (let seat = 0; seat < 4; seat++) {
			const s = this.seats[seat];
			if (!s || s.conn !== conn) continue;
			if (s.takeoverTimer !== undefined) {
				clearTimeout(s.takeoverTimer);
				s.takeoverTimer = undefined;
			}
			if (this.state === null) {
				this.seats[seat] = null;
				this.broadcastLobby();
			} else {
				s.bot = true; // explicit leave mid-game: hand the seat to a bot now
				s.name = BOT_NAMES[seat % BOT_NAMES.length]!;
				this.broadcastEvent('botTakeover', seat);
				this.broadcastState();
			}
			this.persist();
			this.scheduleBot();
		}
	}

	/** Host action: fill every open seat with a bot and deal the first hand. */
	start(conn: SeatConn): void {
		if (this.state !== null) return this.sendError(conn, 'already_started', -1);
		const host = this.hostSeat();
		const caller = this.seatOf(conn);
		if (caller === -1 || caller !== host) return this.sendError(conn, 'not_host', -1);
		for (let seat = 0; seat < 4; seat++) {
			if (this.seats[seat] === null) {
				this.seats[seat] = {
					name: BOT_NAMES[seat % BOT_NAMES.length]!,
					sid: `bot:${this.code}:${seat}`,
					conn: null,
					bot: true,
					lastSeq: 0,
					takeoverTimer: undefined
				};
			}
		}
		this.state = createGame(this.seed);
		this.seq++;
		this.broadcastState();
		this.scheduleBot();
	}

	private sendError(conn: SeatConn, code: string, on: number) {
		conn.send({ t: 'error', code, on });
	}

	private seatOf(conn: SeatConn): number {
		return this.seats.findIndex((s) => s !== null && !s.bot && s.conn === conn);
	}

	nextHand(conn: SeatConn): void {
		const seat = this.seatOf(conn);
		if (this.state === null || seat === -1) return this.sendError(conn, 'not_playing', -1);
		if (this.state.phase !== 'handOver') return this.sendError(conn, 'not_hand_over', this.seq);
		this.state = nextHand(this.state);
		this.seq++;
		this.broadcastEvent('nextHand', -1);
		this.broadcastState();
		this.scheduleBot();
	}

	/**
	 * Applies a human action. Idempotent per seat: replays (seq ≤ lastSeq) are
	 * silently dropped, stale counters are rejected.
	 */
	action(conn: SeatConn, seq: number, action: Action): void {
		const seat = this.seatOf(conn);
		if (this.state === null || seat === -1) return this.sendError(conn, 'not_playing', seq);
		const s = this.seats[seat]!;
		if (seq <= s.lastSeq) return; // duplicate/retry — already applied or superseded
		if (seq > s.lastSeq + 1) return this.sendError(conn, 'stale_seq', seq);
		if (this.state.phase !== 'playing') return this.sendError(conn, 'not_playing', seq);
		if (this.state.turn !== seat) return this.sendError(conn, 'not_your_turn', seq);
		try {
			this.state = applyMove(this.state, seat, action);
		} catch (err) {
			const code = err instanceof Error && 'code' in err ? String((err as { code: unknown }).code) : 'invalid_action';
			return this.sendError(conn, code, seq);
		}
		s.lastSeq = seq;
		this.seq++;
		this.broadcastEvent(action.type === 'pass' ? 'passed' : 'played', seat, action);
		this.broadcastState();
		this.scheduleBot();
	}

	/** Runs the engine clock: whenever a bot must act, act after a short delay. */
	private scheduleBot() {
		if (this.botTimer !== undefined) {
			clearTimeout(this.botTimer);
			this.botTimer = undefined;
		}
		if (this.state === null || this.state.phase !== 'playing') return;
		const seat = this.state.turn;
		if (seat === -1) return;
		const s = this.seats[seat];
		if (!s || !s.bot) return;
		this.botTimer = setTimeout(() => {
			this.botTimer = undefined;
			if (this.state === null || this.state.phase !== 'playing' || this.state.turn !== seat) return;
			if (!s.bot) return; // human reclaimed mid-delay
			const action = greedyBot(this.state, seat);
			try {
				this.state = applyMove(this.state, seat, action);
			} catch {
				return; // never: greedyBot only returns legal moves
			}
			this.seq++;
			this.broadcastEvent(action.type === 'pass' ? 'passed' : 'played', seat, action);
			this.broadcastState();
			this.scheduleBot();
		}, this.botDelayMs);
	}

	/** Test/driver accessor: is this seat currently engine-driven? */
	seatIsBot(seat: number): boolean {
		return this.seats[seat]?.bot ?? false;
	}

	/** Stops all timers (room teardown / test cleanup). */
	close() {
		this.closed = true;
		clearTimeout(this.botTimer);
		for (const s of this.seats) {
			if (s?.takeoverTimer !== undefined) {
				clearTimeout(s.takeoverTimer);
				s.takeoverTimer = undefined;
			}
		}
	}
}

/** 4-char room code (unambiguous alphabet). */
export function makeRoomCode(rand: () => number = Math.random): string {
	const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
	return Array.from({ length: 4 }, () => alphabet[Math.floor(rand() * alphabet.length)]).join('');
}

import { createServer } from 'node:http';
import { WebSocketServer, type WebSocket } from 'ws';
import type { ClientMessage, ServerMessage } from '@thirteen/protocol';
import { Room, RoomError, makeRoomCode, type SeatConn } from './room.js';
import { deleteRoomState } from './db.js';
import { loadEnvLocal } from './env.js';

loadEnvLocal();

export interface ServerHandle {
	port: number;
	close(): Promise<void>;
}

export interface ServerOptions {
	port?: number;
	/** Interval for sweeping lobby rooms with no connected humans. */
	sweepIntervalMs?: number;
	seedFactory?: () => number | undefined;
	/** Max concurrent rooms — bounds memory and Postgres row churn. */
	maxRooms?: number;
	/** Sustained client messages/second per socket. */
	msgRatePerSec?: number;
	/** Token-bucket burst (messages allowed back-to-back). */
	msgBurst?: number;
}

/** Room codes are 4 chars from makeRoomCode's unambiguous alphabet. */
const ROOM_CODE_RE = /^[A-Z0-9]{4}$/;

/**
 * Field-level validation before any room logic runs. Returns the error code
 * for a malformed message (protocol violation → the socket is closed) or
 * null when the message is well-formed.
 */
function validateMessage(msg: ClientMessage): string | null {
	switch (msg.t) {
		case 'create':
		case 'join':
			if (typeof msg.name !== 'string' || typeof msg.sid !== 'string') return 'bad_request';
			if (msg.password !== undefined && typeof msg.password !== 'string') return 'bad_request';
			if (msg.t === 'join') {
				if (typeof msg.room !== 'string' || !ROOM_CODE_RE.test(msg.room.toUpperCase())) {
					return 'bad_request';
				}
				if (msg.token !== undefined && typeof msg.token !== 'string') return 'bad_request';
			}
			return null;
		case 'action':
			if (!Number.isInteger(msg.seq) || msg.seq < 1) return 'bad_request';
			if (typeof msg.action !== 'object' || msg.action === null) return 'bad_request';
			return null;
		case 'kick':
			return Number.isInteger(msg.seat) && msg.seat >= 0 && msg.seat <= 3 ? null : 'bad_request';
		case 'chat':
			return typeof msg.text === 'string' ? null : 'bad_request';
		case 'start':
		case 'nextHand':
		case 'leave':
		case 'ping':
			return null;
		default:
			return 'bad_request';
	}
}

/** WS frame handling for one connected socket. */
function serveSocket(
	ws: WebSocket,
	rooms: Map<string, Room>,
	limits: { rate: number; burst: number; maxRooms: number },
	restoreRoom: (code: string) => Promise<Room | null | undefined>
) {
	let joined: { room: Room; conn: SeatConn } | undefined;
	const send = (msg: ServerMessage) => ws.send(JSON.stringify(msg));
	const seatConn: SeatConn = { send };
	// Token bucket: `burst` messages back-to-back, refilling at `rate`/s.
	let tokens = limits.burst;
	let lastRefill = Date.now();
	const allowMessage = () => {
		const now = Date.now();
		tokens = Math.min(limits.burst, tokens + ((now - lastRefill) / 1000) * limits.rate);
		lastRefill = now;
		if (tokens < 1) return false;
		tokens -= 1;
		return true;
	};
	// Oversized frames (maxPayload) and protocol violations emit an unhandled
	// 'error' that would crash the process — swallow; 'close' fires after and
	// cleans up the seat.
	ws.on('error', () => {});

	ws.on('close', () => {
		if (joined) joined.room.disconnect(seatConn);
	});
	ws.on('message', async (raw) => {
		// Rate gate first: floods die before JSON parsing or room work.
		if (!allowMessage()) {
			send({ t: 'error', code: 'rate_limited', on: -1 });
			ws.close(1008, 'rate limited');
			return;
		}
		let msg: ClientMessage;
		try {
			msg = JSON.parse(String(raw)) as ClientMessage;
		} catch {
			send({ t: 'error', code: 'bad_json', on: -1 });
			return;
		}
		const bad = validateMessage(msg);
		if (bad) {
			// Protocol violation: no unvalidated field ever reaches room logic
			// (a wrong-typed field used to throw in here and kill the process).
			send({ t: 'error', code: bad, on: -1 });
			ws.close(1008, 'bad request');
			return;
		}
		try {
			await handle(msg);
		} catch {
			// Backstop: no client message may crash the process via an
			// unhandled rejection; tear the socket down instead.
			send({ t: 'error', code: 'bad_request', on: -1 });
			ws.close(1008, 'bad request');
		}
	});

	async function handle(msg: ClientMessage): Promise<void> {
		if (joined) {
			const { room, conn } = joined;
			switch (msg.t) {
				case 'start':
					return room.start(conn);
				case 'action':
					return room.action(conn, msg.seq, msg.action);
				case 'nextHand':
					return room.nextHand(conn);
				case 'kick':
					return room.kick(conn, msg.seat);
				case 'chat':
					return room.chat(conn, msg.text);
				case 'ping':
					return send({ t: 'pong' });
				case 'leave':
					return room.leave(conn);
				default:
					return send({ t: 'error', code: 'already_joined', on: -1 });
			}
		}
		switch (msg.t) {
			case 'create': {
				if (rooms.size >= limits.maxRooms) {
					return send({ t: 'error', code: 'server_full', on: -1 });
				}
				let code = makeRoomCode();
				while (rooms.has(code)) code = makeRoomCode();
				const room = new Room({ code, password: msg.password, seed: undefined });
				rooms.set(code, room);
				const seat = room.join(msg.name, msg.sid, seatConn);
				joined = seat === null ? undefined : { room, conn: seatConn };
				return;
			}
			case 'join': {
				const code = msg.room.toUpperCase();
				let room: Room | null | undefined = rooms.get(code);
				if (!room) {
					if (rooms.size >= limits.maxRooms) {
						return send({ t: 'error', code: 'server_full', on: -1 });
					}
					// Not in memory — a refresh/rejoin after a server restart can
					// still resume the game from the persisted snapshot.
					room = await restoreRoom(code);
					if (room) rooms.set(code, room);
					else if (room === undefined) {
						// Restore quota exhausted (unknown-room flood guard): drop the
						// socket so the client's reconnect backoff retries the join.
						return ws.close(1013, 'try again later');
					} else {
						return send({ t: 'error', code: 'room_not_found', on: -1 });
					}
				}
				let seat: number | null;
				try {
					seat = room.join(msg.name, msg.sid, seatConn, msg.password, msg.token);
				} catch (err) {
					if (err instanceof RoomError) return send({ t: 'error', code: err.code, on: -1 });
					throw err;
				}
				if (seat === null) return send({ t: 'error', code: 'room_full', on: -1 });
				joined = { room, conn: seatConn };
				return;
			}
			default:
				return send({ t: 'error', code: 'not_joined', on: -1 });
		}
	}
}

/**
 * The game server: HTTP health endpoint plus WS upgrades on `/ws`. Rooms live
 * in memory and mirror to Postgres when DATABASE_URL is set; the sweep drops
 * abandoned lobby rooms from both.
 */
export function startServer(options: ServerOptions = {}): Promise<ServerHandle> {
	const rooms = new Map<string, Room>();
	const limits = {
		maxRooms: options.maxRooms ?? 256,
		rate: options.msgRatePerSec ?? 20,
		burst: options.msgBurst ?? 40
	};
	// Restore lookups hit Postgres once per unknown room code — a flood of
	// joins with random codes would otherwise hammer the DB. Shared token
	// bucket plus in-flight dedupe (concurrent joins of one code pay once).
	// Resolves undefined when the budget is exhausted (caller: drop the
	// socket so the client retries), null when no such room exists.
	const RESTORES_PER_SEC = 20;
	let restoreTokens = RESTORES_PER_SEC;
	let restoreRefill = Date.now();
	const restoreInFlight = new Map<string, Promise<Room | null | undefined>>();
	const restoreRoom = async (code: string): Promise<Room | null | undefined> => {
		const now = Date.now();
		restoreTokens = Math.min(
			RESTORES_PER_SEC,
			restoreTokens + ((now - restoreRefill) / 1000) * RESTORES_PER_SEC
		);
		restoreRefill = now;
		if (restoreTokens < 1) return undefined;
		restoreTokens -= 1;
		let pending = restoreInFlight.get(code);
		if (!pending) {
			pending = Room.restore(code).finally(() => restoreInFlight.delete(code));
			restoreInFlight.set(code, pending);
		}
		return pending;
	};
	const sweep = setInterval(() => {
		for (const [code, room] of rooms) {
			if (room.isEmpty() && room.phase() === 'lobby') {
				room.close();
				rooms.delete(code);
				void deleteRoomState(code);
			}
		}
	}, options.sweepIntervalMs ?? 5 * 60_000);

	// maxPayload kills oversized frames at the protocol level (close 1009) —
	// no client message legitimately approaches 4 KiB.
	const wss = new WebSocketServer({ noServer: true, maxPayload: 4096 });
	wss.on('connection', (ws: WebSocket) => serveSocket(ws, rooms, limits, restoreRoom));

	const http = createServer((_req, res) => {
		res.writeHead(200, { 'content-type': 'application/json' });
		res.end(JSON.stringify({ ok: true, rooms: rooms.size }));
	});
	http.on('upgrade', (req, socket, head) => {
		const { pathname } = new URL(req.url ?? '/', 'http://localhost');
		if (pathname !== '/ws') {
			socket.destroy();
			return;
		}
		wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
	});

	const { promise, resolve } = Promise.withResolvers<ServerHandle>();
	http.listen(options.port ?? 8787, () => {
		const bound = (http.address() as { port: number }).port;
		resolve({
			port: bound,
			close: async () => {
				clearInterval(sweep);
				for (const room of rooms.values()) room.close();
				await Promise.all([
					new Promise<void>((done) => wss.close(() => done())),
					new Promise<void>((done) => http.close(() => done()))
				]);
			}
		});
	});
	return promise;
}

// Entry point when run directly: `pnpm --filter @thirteen/server start`.
if (process.argv[1]?.endsWith('index.ts')) {
	startServer({ port: Number(process.env.PORT ?? 8787) }).then((h) => {
		console.log(`thirteen game server on :${h.port}`);
	});
}

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

/** WS frame handling for one connected socket. */
function serveSocket(
	ws: WebSocket,
	rooms: Map<string, Room>,
	limits: { rate: number; burst: number; maxRooms: number }
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
		if (joined) {
			const { room, conn } = joined;
			switch (msg.t) {
				case 'start':
					return room.start(conn);
				case 'action':
					return room.action(conn, msg.seq, msg.action);
				case 'nextHand':
					return room.nextHand(conn);
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
					// Not in memory — a refresh/rejoin after a server restart can
					// still resume the game from the persisted snapshot.
					room = await Room.restore(code);
					if (room) rooms.set(code, room);
				}
				if (!room) return send({ t: 'error', code: 'room_not_found', on: -1 });
				let seat: number | null;
				try {
					seat = room.join(msg.name, msg.sid, seatConn, msg.password);
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
	});
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
	wss.on('connection', (ws: WebSocket) => serveSocket(ws, rooms, limits));

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

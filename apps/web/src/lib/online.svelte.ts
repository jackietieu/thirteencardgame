import { legalMoves, validateMove, type Move } from '@thirteen/engine';
import type { SeatView, ServerChat, ServerMessage } from '@thirteen/protocol';
import { getName, setName } from '$lib/name';
import { DEAL_INTERVAL_FAST_MS, DEAL_INTERVAL_MS } from '$lib/game.svelte';
import type { GameDriver, LogEntry } from '$lib/driver';

/** One chat message in display coordinates (0 = me). */
export interface ChatMsg {
	seat: number;
	name: string;
	text: string;
}

type Status = 'idle' | 'connecting' | 'lobby' | 'playing' | 'reconnecting';
const SID_KEY = 'thirteen.sid';
const ROOM_KEY = 'thirteen.room';

function getSid(): string {
	let sid = localStorage.getItem(SID_KEY);
	if (!sid) {
		sid = crypto.randomUUID();
		localStorage.setItem(SID_KEY, sid);
	}
	return sid;
}

function getSavedRoom(): string {
	return localStorage.getItem(ROOM_KEY) ?? '';
}

/** Persisting a room code lets a reload rejoin (and reclaim the seat) automatically. */
function saveRoom(room: string) {
	if (room) localStorage.setItem(ROOM_KEY, room);
	else localStorage.removeItem(ROOM_KEY);
}


/**
 * Online driver: speaks the room protocol over WS. The server is
 * authoritative — this store renders snapshots (already rotated per seat) and
 * forwards intents. Reloads resume the seat via the stable sid + saved room.
 */
function wsUrl(): string {
	// Hosted: point VITE_GAME_WS_URL at the game server (wss://…). Unset —
	// same-origin /ws (vite dev proxy, or a reverse proxy in production).
	const hosted = import.meta.env.VITE_GAME_WS_URL;
	if (hosted) return hosted;
	const proto = location.protocol === 'https:' ? 'wss' : 'ws';
	return `${proto}://${location.host}/ws`;
}

class OnlineGameStore implements GameDriver {
	state = $state<SeatView | null>(null);
	seatNames = $state<string[]>([]);
	log = $state<LogEntry[]>([]);
	autoPass = $state(false);
	lastError = $state<string | null>(null);
	shake = $state(0);
	dealingPending = $state(false);
	dealing = $state(false);
	dealProgress = $state(0);

	status = $state<Status>('idle');
	room = $state('');
	/** Lobby snapshot while waiting for the host to start. */
	lobbyPlayers = $state<string[]>([]);
	lobbyBots = $state<boolean[]>([]);
	chat = $state<ChatMsg[]>([]);
	/** Messages arrived while the chat panel was closed. */
	chatUnread = $state(0);
	/** Set when the server rejects a chat message (moderation). */
	chatNotice = $state('');
	/** Heartbeat machinery: half-open sockets must not silently eat frames. */
	private heartbeat: ReturnType<typeof setInterval> | undefined;
	private lastPongAt = 0;
	mySeat = $state(-1);
	hostSeat = $state(-1);
	/** Last room we successfully joined — reconnects re-join it, never re-create. */
	private lastRoom = '';
	/** The room requires a lobby password — the join form must show the field. */
	needsPassword = $state(false);

	private ws: WebSocket | null = null;
	private seq = 0;
	private backoffMs = 500;
	private reconnectTimer: ReturnType<typeof setTimeout> | undefined;
	private dealTimer: ReturnType<typeof setTimeout> | undefined;
	private openHandler: ((ws: WebSocket) => void) | null = null;

	get fast() {
		return typeof location !== 'undefined' && new URLSearchParams(location.search).has('fast');
	}

	legal = $derived<Move[]>(this.state ? legalMoves(this.state, 0) : []);
	myTurn = $derived(this.state?.phase === 'playing' && this.state.turn === 0);

	create(password?: string) {
		this.needsPassword = false;
		this.connect((ws) =>
			ws.send(JSON.stringify({ t: 'create', sid: getSid(), name: getName() || 'Player', password }))
		);
	}

	join(code: string, password?: string) {
		const room = code.trim().toUpperCase();
		this.needsPassword = false;
		this.chat = [];
		this.chatUnread = 0;
		this.connect((ws) =>
			ws.send(JSON.stringify({ t: 'join', room, sid: getSid(), name: getName() || 'Player', password }))
		);
	}

	/** Host action: fill empty seats with bots and deal. */
	start() {
		this.send({ t: 'start' });
	}

	private connect(open: (ws: WebSocket) => void) {
		this.cancelTimers();
		this.openHandler = open;
		this.status = 'connecting';
		this.openSocket(open);
	}

	sendChat(text: string) {
		const trimmed = text.trim().slice(0, 280);
		if (trimmed) this.send({ t: 'chat', text: trimmed });
	}

	markChatRead() {
		this.chatUnread = 0;
	}

	private openSocket(open: (ws: WebSocket) => void) {
		const ws = new WebSocket(wsUrl());
		this.ws = ws;
		this.startHeartbeat(ws);
		ws.onopen = () => {
			this.backoffMs = 500;
			open(ws);
		};
		ws.onmessage = (e) => this.onMessage(JSON.parse(String(e.data)) as ServerMessage);
		ws.onclose = () => {
			this.stopHeartbeat();
			if (this.status === 'idle') return;
			this.status = 'reconnecting';
			this.backoffMs = Math.min(this.backoffMs * 2, 5000);
			this.reconnectTimer = setTimeout(() => this.reconnect(), this.backoffMs);
		};
	}

	/** Pings every 20s; a socket silent for 45s is presumed dead and closed,
	 *  which triggers the normal reconnect path. */
	private startHeartbeat(ws: WebSocket) {
		this.stopHeartbeat();
		this.lastPongAt = Date.now();
		this.heartbeat = setInterval(() => {
			if (ws.readyState === WebSocket.OPEN) this.send({ t: 'ping' });
			if (Date.now() - this.lastPongAt > 45_000) ws.close();
		}, 20_000);
	}

	private stopHeartbeat() {
		clearInterval(this.heartbeat);
		this.heartbeat = undefined;
	}


	/**
	 * Resume after a dropped socket. Once we have been in a room, re-join it
	 * (the sid reclaims our seat server-side) — never replay `create`, which
	 * would silently open a fresh room instead of resuming the game.
	 */
	private reconnect() {
		const room = this.lastRoom || getSavedRoom();
		if (room && this.status === 'reconnecting') {
			this.openSocket((ws) =>
				ws.send(JSON.stringify({ t: 'join', room, sid: getSid(), name: getName() || 'Player' }))
			);
			// The server replays chat history for the fresh join: drop local
			// copies so messages are not duplicated.
			this.chat = [];
			this.chatUnread = 0;
			return;
		}
		if (this.openHandler) this.openSocket(this.openHandler);
	}

	private onMessage(msg: ServerMessage) {
		switch (msg.t) {
			case 'lobby':
				this.status = 'lobby';
				this.room = msg.room;
				this.lastRoom = msg.room;
				saveRoom(msg.room);
				this.lobbyPlayers = msg.players;
				this.lobbyBots = msg.bots;
				this.mySeat = msg.seat;
				this.hostSeat = msg.hostSeat;
				return;
			case 'state': {
				const prev = this.state;
				this.status = 'playing';
				this.room = this.room || getSavedRoom();
				this.lastRoom = this.room;
				saveRoom(this.room);
				this.mySeat = msg.seat;
				this.seatNames = msg.seatNames;
				this.state = msg.state;
				// A fresh hand arrived (start, next hand, or rejoin mid-deal): animate.
				if (msg.state.phase === 'playing' && (prev === null || prev.handNumber !== msg.state.handNumber)) {
					this.dealingPending = false;
					this.dealing = true;
					this.dealProgress = 0;
					this.tickDealing();
				}
				return;
			}
			case 'chat': {
				const m: ServerChat = msg;
				this.chat.push({ seat: m.seat, name: m.name, text: m.text });
				if (this.chat.length > 100) this.chat.shift();
				if (m.seat !== 0) this.chatUnread++;
				return;
			}
			case 'pong':
				this.lastPongAt = Date.now();
				return;
			case 'event':
				if (msg.name === 'played' || msg.name === 'passed') {
					this.log.push({
						seat: msg.seat,
						action: msg.action ?? { type: 'pass', cards: [] },
						handNumber: msg.handNumber
					});
				}
				return;
			case 'error': {
				// Join rejections leave the socket un-joined: reset to the connect
				// screen instead of waiting forever on a lobby that never comes.
				const rejectedJoin =
					this.state === null &&
					(msg.code === 'bad_password' || msg.code === 'room_not_found' || msg.code === 'room_full' || msg.code === 'server_full');
				if (msg.code === 'room_not_found') saveRoom('');
				if (rejectedJoin) {
					const code = msg.code;
					this.openHandler = null;
					this.teardown();
					if (code === 'bad_password') this.needsPassword = true;
					this.lastError = code;
					return;
				}
				if (msg.code === 'chat_blocked') {
					this.chatNotice = 'Message blocked by moderation';
					return;
				}
				if (msg.code !== 'not_joined') {
					this.lastError = msg.code;
					this.shake++;
				}
				return;
			}
			default:
				return;
		}
	}

	/** Leave the room and return to the connect screen. */
	leave() {
		if (this.ws && this.ws.readyState === WebSocket.OPEN) {
			this.ws.send(JSON.stringify({ t: 'leave' }));
		}
		this.lastRoom = '';
		saveRoom('');
		this.teardown();
	}

	private teardown() {
		this.status = 'idle';
		this.state = null;
		this.log = [];
		this.chatNotice = '';
		this.chat = [];
		this.chatUnread = 0;
		this.room = '';
		this.dealing = false;
		this.dealingPending = false;
		this.dealProgress = 0;
		this.lastError = null;
		this.cancelTimers();
		this.stopHeartbeat();
		if (this.ws) {
			this.ws.onclose = null;
			this.ws.close();
			this.ws = null;
		}
	}

	private cancelTimers() {
		clearTimeout(this.reconnectTimer);
		clearTimeout(this.dealTimer);
	}

	private tickDealing() {
		if (!this.dealing) return;
		if (this.dealProgress >= 52) {
			this.dealing = false;
			return;
		}
		this.dealProgress++;
		this.dealTimer = setTimeout(() => this.tickDealing(), this.fast ? DEAL_INTERVAL_FAST_MS : DEAL_INTERVAL_MS);
	}

	/** Online deals start automatically; the Deal button contract is a no-op here. */
	startDealing() {
		if (!this.dealingPending) return;
		this.dealingPending = false;
		this.dealing = true;
		this.dealProgress = 0;
		this.tickDealing();
	}

	play(move: Move) {
		const state = this.state;
		if (!state || state.turn !== 0) return;
		if (this.dealing || this.dealingPending) return; // wait for the deal
		// Preview validation for fast feedback; the server re-validates.
		if (validateMove(state, 0, move) !== null) {
			this.lastError = 'invalid_combo';
			this.shake++;
			return;
		}
		this.send({ t: 'action', seq: ++this.seq, action: move });
	}

	pass() {
		const state = this.state;
		if (!state || state.phase !== 'playing' || state.turn !== 0) return;
		if (this.dealing || this.dealingPending) return; // wait for the deal
		if (state.trick.plays.length === 0) return; // leader must play
		this.send({ t: 'action', seq: ++this.seq, action: { type: 'pass', cards: [] } });
	}

	nextHand() {
		if (this.state?.phase !== 'handOver') return;
		this.send({ t: 'nextHand' });
	}

	private send(msg: Record<string, unknown>) {
		if (this.ws && this.ws.readyState === WebSocket.OPEN) {
			this.ws.send(JSON.stringify(msg));
		}
	}
}

export const online = new OnlineGameStore();

// Auto-resume: a saved room + name rejoins the seat on page load (reload support).
// A ?room= share link takes precedence — the /online page drives that join instead.
if (typeof window !== 'undefined') {
	const fromLink = new URLSearchParams(window.location.search).get('room');
	const saved = fromLink ? '' : getSavedRoom();
	if (saved && getName()) online.join(saved);
}

import { legalMoves, validateMove, type Move } from '@thirteen/engine';
import type { SeatView, ServerMessage } from '@thirteen/protocol';
import { DEAL_INTERVAL_FAST_MS, DEAL_INTERVAL_MS } from '$lib/game.svelte';
import type { GameDriver, LogEntry } from '$lib/driver';

type Status = 'idle' | 'connecting' | 'lobby' | 'playing' | 'reconnecting';

const SID_KEY = 'thirteen.sid';
const NAME_KEY = 'thirteen.name';
const ROOM_KEY = 'thirteen.room';

function getSid(): string {
	let sid = localStorage.getItem(SID_KEY);
	if (!sid) {
		sid = crypto.randomUUID();
		localStorage.setItem(SID_KEY, sid);
	}
	return sid;
}

export function getName(): string {
	return localStorage.getItem(NAME_KEY) ?? '';
}

export function setName(name: string) {
	localStorage.setItem(NAME_KEY, name);
}

function getSavedRoom(): string {
	return localStorage.getItem(ROOM_KEY) ?? '';
}

/** Persisting a room code lets a reload rejoin (and reclaim the seat) automatically. */
function saveRoom(room: string) {
	if (room) localStorage.setItem(ROOM_KEY, room);
	else localStorage.removeItem(ROOM_KEY);
}

function wsUrl(): string {
	const proto = location.protocol === 'https:' ? 'wss' : 'ws';
	return `${proto}://${location.host}/ws`;
}

/**
 * Online driver: speaks the room protocol over WS. The server is
 * authoritative — this store renders snapshots (already rotated per seat) and
 * forwards intents. Reloads resume the seat via the stable sid + saved room.
 */
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
	mySeat = $state(-1);
	hostSeat = $state(-1);

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

	create() {
		this.connect((ws) => ws.send(JSON.stringify({ t: 'create', sid: getSid(), name: getName() || 'Player' })));
	}

	join(code: string) {
		const room = code.trim().toUpperCase();
		this.connect((ws) => ws.send(JSON.stringify({ t: 'join', room, sid: getSid(), name: getName() || 'Player' })));
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

	private openSocket(open: (ws: WebSocket) => void) {
		const ws = new WebSocket(wsUrl());
		this.ws = ws;
		ws.onopen = () => {
			this.backoffMs = 500;
			open(ws);
		};
		ws.onmessage = (e) => this.onMessage(JSON.parse(String(e.data)) as ServerMessage);
		ws.onclose = () => {
			if (this.status === 'idle') return;
			// Resume: retry until the room accepts us again (seat survives server-side).
			this.status = 'reconnecting';
			this.backoffMs = Math.min(this.backoffMs * 2, 5000);
			this.reconnectTimer = setTimeout(() => {
				if (this.openHandler) this.openSocket(this.openHandler);
			}, this.backoffMs);
		};
	}

	private onMessage(msg: ServerMessage) {
		switch (msg.t) {
			case 'lobby':
				this.status = 'lobby';
				this.room = msg.room;
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
			case 'event':
				if (msg.name === 'played' || msg.name === 'passed') {
					this.log.push({
						seat: msg.seat,
						action: msg.action ?? { type: 'pass', cards: [] },
						handNumber: msg.handNumber
					});
				}
				return;
			case 'error':
				if (msg.code === 'room_not_found') saveRoom('');
				if (msg.code !== 'not_joined') {
					this.lastError = msg.code;
					this.shake++;
				}
				return;
			default:
				return;
		}
	}

	/** Leave the room and return to the connect screen. */
	leave() {
		if (this.ws && this.ws.readyState === WebSocket.OPEN) {
			this.ws.send(JSON.stringify({ t: 'leave' }));
		}
		saveRoom('');
		this.teardown();
	}

	private teardown() {
		this.status = 'idle';
		this.state = null;
		this.log = [];
		this.room = '';
		this.dealing = false;
		this.dealingPending = false;
		this.dealProgress = 0;
		this.lastError = null;
		this.cancelTimers();
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
if (typeof window !== 'undefined') {
	const saved = getSavedRoom();
	if (saved && getName()) online.join(saved);
}

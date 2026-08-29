import { greedyBot } from '@thirteen/bots';
import {
	applyMove,
	buildState,
	canPass,
	classify,
	createGame,
	describeMove,
	legalMoves,
	nextHand as engineNextHand,
	validateMove,
	type Action,
	type GameState,
	type Move
} from '@thirteen/engine';

export interface LogEntry {
	seat: number;
	action: Action;
	handNumber: number;
}

class GameStore {
	state = $state<GameState | null>(null);
	log = $state<LogEntry[]>([]);
	autoPass = $state(false);
	/** MoveError code from your last rejected play. */
	lastError = $state<string | null>(null);
	/** Increment to retrigger the shake animation on the action bar. */
	shake = $state(0);

	/** Plain field: bumping it invalidates pending bot timers after a reset. */
	private generation = 0;
	private timer: ReturnType<typeof setTimeout> | undefined;

	/** Read at call time — module eval can run before the router commits the URL. */
	get fast() {
		return new URLSearchParams(location.search).has('fast');
	}
	get urlSeed(): number | null {
		const raw = new URLSearchParams(location.search).get('seed');
		if (raw === null) return null;
		const n = Number.parseInt(raw, 10);
		return Number.isNaN(n) ? null : n;
	}

	legal = $derived<Move[]>(this.state ? legalMoves(this.state, 0) : []);
	myTurn = $derived(this.state?.phase === 'playing' && this.state.turn === 0);

	newGame(seed?: number) {
		this.cancelTimer();
		this.generation++;
		this.state = createGame(seed ?? this.urlSeed ?? undefined);
		this.log = [];
		this.lastError = null;
		this.schedule();
	}

	/** Test hook: adopt an externally built state (E2E scenarios). */
	loadState(state: GameState) {
		this.cancelTimer();
		this.generation++;
		this.state = state;
		this.log = [];
		this.lastError = null;
		this.schedule();
	}

	play(move: Move) {
		const state = this.state;
		if (!state || state.turn !== 0) return;
		const error = validateMove(state, 0, move);
		if (error !== null) {
			this.lastError = error;
			this.shake++;
			return;
		}
		this.commit(state, 0, move);
		this.lastError = null;
	}

	pass() {
		const state = this.state;
		if (!state || !canPass(state, 0)) return;
		this.commit(state, 0, { type: 'pass', cards: [] });
	}

	nextHand() {
		const state = this.state;
		if (!state || state.phase !== 'handOver') return;
		this.cancelTimer();
		this.generation++;
		this.state = engineNextHand(state);
		this.lastError = null;
		this.schedule();
	}

	private cancelTimer() {
		if (this.timer !== undefined) {
			clearTimeout(this.timer);
			this.timer = undefined;
		}
	}

	/** Bots are driven from explicit calls (never $effect) to avoid loops. */
	private schedule() {
		this.cancelTimer();
		const state = this.state;
		if (!state || state.phase !== 'playing' || state.turn === 0 || state.turn === -1) return;
		const gen = this.generation;
		const observed = state;
		this.timer = setTimeout(
			() => {
				if (this.generation !== gen || this.state !== observed) return;
				this.commit(observed, observed.turn, greedyBot(observed, observed.turn));
			},
			this.fast ? 0 : 600 + Math.random() * 600
		);
	}

	private commit(prev: GameState, seat: number, action: Action) {
		this.cancelTimer();
		const next = applyMove(prev, seat, action);
		this.log.push({ seat, action, handNumber: prev.handNumber });
		this.state = next;
		if (next.phase === 'playing') this.schedule();
	}
}

export const game = new GameStore();

export const SEAT_NAMES = ['You', 'West', 'North', 'East'] as const;

// Dev/test hook — always available against the dev server (E2E and manual QA);
// tree-shaken out of production builds.
if (import.meta.env.DEV && typeof window !== 'undefined') {
	(window as unknown as Record<string, unknown>).__thirteen = {
		store: game,
		engine: { createGame, legalMoves, classify, validateMove, describeMove, buildState, canPass }
	};
}

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
	rngStep,
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

export const BOT_NAME_POOL = [
	// 25% Vietnamese, 75% American names.
	'Hùng',
	'Lan',
	'Mai',
	'Tuấn',
	'Smith',
	'Johnson',
	'Williams',
	'Brown',
	'Jones',
	'Miller',
	'Davis',
	'Wilson',
	'Anderson',
	'Taylor',
	'Thomas',
	'Moore'
] as const;

/** Milliseconds between dealt cards in the dealing animation (normal pace). */
export const DEAL_INTERVAL_MS = 45;
/** Pace used under ?fast=1 so E2E runs are quick but still ordered. */
export const DEAL_INTERVAL_FAST_MS = 12;

function pickBotNames(seed: number): string[] {
	let rng = (seed ^ 0x5f3_759d) >>> 0;
	const pool = [...BOT_NAME_POOL];
	const names: string[] = ['You'];
	for (let i = 0; i < 3; i++) {
		const step = rngStep(rng);
		rng = step.state;
		const index = Math.floor(step.float * pool.length);
		names.push(pool.splice(index, 1)[0]!);
	}
	return names;
}

class GameStore {
	state = $state<GameState | null>(null);
	log = $state<LogEntry[]>([]);
	autoPass = $state(false);
	/** MoveError code from your last rejected play. */
	lastError = $state<string | null>(null);
	/** Increment to retrigger the shake animation on the action bar. */
	shake = $state(0);
	/** Per-game display names; seat 0 is always You. */
	seatNames = $state<string[]>(['You', 'West', 'North', 'East']);
	/** Waiting for the Deal button — shown at the start of a new game. */
	dealingPending = $state(false);
	/** One-by-one dealing animation in progress. */
	dealing = $state(false);
	/** Cards dealt so far in the running animation (0..52). */
	dealProgress = $state(0);

	/** Plain field: bumping it invalidates pending bot/deal timers after a reset. */
	private generation = 0;
	private timer: ReturnType<typeof setTimeout> | undefined;
	private dealTimer: ReturnType<typeof setTimeout> | undefined;

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
		this.cancelTimers();
		this.generation++;
		this.state = createGame(seed ?? this.urlSeed ?? undefined);
		// state.rngState is the seed createGame used, so names follow ?seed too.
		this.seatNames = pickBotNames(this.state.rngState);
		this.dealingPending = true;
		this.lastError = null;
		this.dealing = false;
		this.dealProgress = 0;
	}

	/** Test hook: adopt an externally built state (E2E scenarios) — skips the deal gate. */
	loadState(state: GameState) {
		this.cancelTimers();
		this.generation++;
		this.state = state;
		this.log = [];
		this.lastError = null;
		this.dealingPending = false;
		this.dealing = false;
		this.dealProgress = 0;
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
		this.cancelTimers();
		this.generation++;
		this.state = engineNextHand(state);
		this.lastError = null;
		this.dealingPending = true;
		this.dealProgress = 0;
		this.startDealing();
	}

	/** Called by the Deal button: runs the one-by-one dealing animation, then play begins. */
	startDealing() {
		if (!this.dealingPending || !this.state) return;
		this.dealingPending = false;
		this.dealing = true;
		this.dealProgress = 0;
		this.tickDealing(this.generation);
	}

	private tickDealing(gen: number) {
		if (gen !== this.generation || !this.dealing) return;
		if (this.dealProgress >= 52) {
			this.dealing = false;
			this.schedule();
			return;
		}
		this.dealProgress++;
		const pace = this.fast ? DEAL_INTERVAL_FAST_MS : DEAL_INTERVAL_MS;
		this.dealTimer = setTimeout(() => this.tickDealing(gen), pace);
	}

	private cancelTimers() {
		if (this.timer !== undefined) {
			clearTimeout(this.timer);
			this.timer = undefined;
		}
		if (this.dealTimer !== undefined) {
			clearTimeout(this.dealTimer);
			this.dealTimer = undefined;
		}
	}

	/** Bots are driven from explicit calls (never $effect) to avoid loops. */
	private schedule() {
		this.cancelTimer();
		if (this.dealing || this.dealingPending) return;
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

	private cancelTimer() {
		if (this.timer !== undefined) {
			clearTimeout(this.timer);
			this.timer = undefined;
		}
	}
}

export const game = new GameStore();

if (import.meta.env.DEV && typeof window !== 'undefined') {
	(window as unknown as Record<string, unknown>).__thirteen = {
		store: game,
		engine: { createGame, legalMoves, classify, validateMove, describeMove, buildState, canPass }
	};
}

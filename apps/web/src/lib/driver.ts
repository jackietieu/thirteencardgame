import type { Move, RulesState } from '@thirteen/engine';

/** One logged play or pass. Seats are in display coordinates (0 = you). */
export interface LogEntry {
	seat: number;
	action: Move | { type: 'pass'; cards: [] };
	handNumber: number;
}

/**
 * The surface the game table needs from a game source. Implemented twice:
 * the local bots driver (`game.svelte.ts`) and the online WS driver
 * (`online.svelte.ts`). Seats are always display coordinates — the driver
 * is responsible for putting "me" at seat 0.
 */
export interface GameDriver {
	/** Current game snapshot (seat-rotated, opponents hidden online). */
	readonly state: RulesState | null;
	readonly seatNames: string[];
	readonly log: LogEntry[];
	/** True when it is the local player's turn and the hand is live. */
	readonly myTurn: boolean;
	/** Legal moves for seat 0 (preview only; the server re-validates online). */
	readonly legal: Move[];
	/** Dealing animation machinery (both drivers run it client-side). */
	readonly dealingPending: boolean;
	readonly dealing: boolean;
	readonly dealProgress: number;
	readonly fast: boolean;
	autoPass: boolean;
	/** Error code from the last rejected action. */
	lastError: string | null;
	/** Bump to retrigger the action-bar shake. */
	shake: number;

	play(move: Move): void;
	pass(): void;
	nextHand(): void;
	startDealing(): void;
}

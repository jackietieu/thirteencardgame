import type { Card, GameState, PlayerState, Trick } from './types.js';

/**
 * A seat-scoped view of the game for transport to one client: the recipient is
 * always display seat 0, and opponents' hands are hidden (replaced by
 * `handCount`). Everything else the UI needs is rotated to match, so
 * components can keep assuming "seat 0 = me, clockwise from bottom".
 */
export interface PlayerView extends Omit<PlayerState, 'hand'> {
	/** Full hand for the view's owner; empty array for hidden opponents. */
	hand: Card[];
	/** Number of cards the player actually holds (real for hidden opponents). */
	handCount: number;
}

export interface SeatView extends Omit<GameState, 'players' | 'rngState'> {
	players: PlayerView[];
}

const mod4 = (n: number) => ((n % 4) + 4) % 4;

function rotateTrick(trick: Trick, seat: number): Trick {
	return {
		plays: trick.plays.map((p) => ({ seat: mod4(p.seat - seat), action: p.action })),
		leader: trick.leader === -1 ? -1 : mod4(trick.leader - seat)
	};
}

/**
 * Builds the view of `state` as seen by `seat`. Pure: returns fresh objects,
 * never mutates the authoritative state, and never exposes opponents' cards.
 */
export function viewForSeat(state: GameState, seat: number): SeatView {
	return {
		players: Array.from({ length: 4 }, (_, d) => {
			const p = state.players[mod4(d + seat)]!;
			return {
				hand: d === 0 ? [...p.hand] : [],
				handCount: p.hand.length,
				out: p.out,
				passed: p.passed
			};
		}),
		turn: state.turn === -1 ? -1 : mod4(state.turn - seat),
		trick: rotateTrick(state.trick, seat),
		lastTrick: state.lastTrick === null ? null : rotateTrick(state.lastTrick, seat),
		handNumber: state.handNumber,
		opening: state.opening,
		scores: state.scores.map((_, i) => state.scores[mod4(i + seat)]!),
		phase: state.phase,
		finished: state.finished.map((s) => mod4(s - seat)),
		lastHandWinner:
			state.lastHandWinner === null ? null : mod4(state.lastHandWinner - seat),
		winner: state.winner === null ? null : mod4(state.winner - seat)
	};
}

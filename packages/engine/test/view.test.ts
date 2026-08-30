import { describe, expect, it } from 'vitest';
import type { Card, Trick } from '../src/types.js';
import { buildState, viewForSeat } from '../src/index.js';

const H = (n: number): Card[] => Array.from({ length: n }, (_, i) => ({ rank: 3, suit: (i % 4) as 0 }));

const trick: Trick = {
	plays: [
		{ seat: 0, action: { type: 'single', cards: [{ rank: 5, suit: 1 }] } },
		{ seat: 2, action: { type: 'single', cards: [{ rank: 7, suit: 2 }] } }
	],
	leader: 2
};

const state = buildState({
	hands: [H(13), H(9), H(13), H(17)],
	turn: 1,
	trick,
	lastTrick: { plays: [{ seat: 3, action: { type: 'pair', cards: [{ rank: 9, suit: 0 }, { rank: 9, suit: 1 }] } }], leader: 3 },
	scores: [10, 20, 30, 40],
	finished: [2, 1],
	lastHandWinner: 3,
	winner: null
});

const mod4 = (n: number) => ((n % 4) + 4) % 4;

describe('viewForSeat', () => {
	for (const seat of [0, 1, 2, 3]) {
		it(`seats viewer ${seat} at display seat 0`, () => {
			const view = viewForSeat(state, seat);
			expect(view.players[0]!.hand).toEqual(state.players[seat]!.hand);
			expect(view.turn).toBe(mod4(state.turn - seat));
			expect(view.scores).toEqual([0, 1, 2, 3].map((i) => state.scores[mod4(i + seat)]));
		});
	}

	it('hides opponents’ hands but keeps real counts', () => {
		const view = viewForSeat(state, 2);
		expect(view.players[0]!.handCount).toBe(13);
		expect(view.players[1]!.hand).toEqual([]);
		expect(view.players[1]!.handCount).toBe(17);
		expect(view.players[2]!.handCount).toBe(13);
		expect(view.players[3]!.handCount).toBe(9);
	});
	it('rotates trick plays and leaders into viewer coordinates', () => {
		const view = viewForSeat(state, 2);
		expect(view.trick!.plays.map((p) => p.seat)).toEqual([2, 0]);
		expect(view.trick!.leader).toBe(0);
		expect(view.lastTrick!.plays[0]!.seat).toBe(1);
	});

	it('maps finished order, last winner, and winner', () => {
		const view = viewForSeat(state, 1);
		expect(view.finished).toEqual([1, 0]);
		expect(view.lastHandWinner).toBe(2);
	});

	it('is pure', () => {
		const snapshot = structuredClone(state);
		viewForSeat(state, 2);
		expect(state).toEqual(snapshot);
	});

	it('never serializes opponent cards', () => {
		for (let seat = 0; seat < 4; seat++) {
			const view = viewForSeat(state, seat);
			for (let d = 1; d < 4; d++) {
				expect(JSON.stringify(view.players[d])).not.toContain('"rank"');
			}
		}
	});

	it('never leaks the RNG state (client could precompute the next deal)', () => {
		for (let seat = 0; seat < 4; seat++) {
			expect(Object.hasOwn(viewForSeat(state, seat), 'rngState')).toBe(false);
			expect(JSON.stringify(viewForSeat(state, seat))).not.toContain('"rngState"');
		}
	});
});

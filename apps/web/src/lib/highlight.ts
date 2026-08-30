import { currentRequirement, legalMoves, type Card, type RulesState } from '@thirteen/engine';

/** Canonical card key: rank * 4 + suit. */
export function cardKey(card: Card): string {
	return `${card.rank * 4 + card.suit}`;
}

/**
 * Card keys that participate in ≥1 legal move for `seat`.
 *
 * `legalMoves` enumerates one representative per (shape, size, top card), so for
 * sequence/doublesequence requirements we extend suit-agnostically: any window of
 * the same length whose ranks are all present (and that can beat the requirement's
 * top card) glows every card in its ranks.
 */
export function participatingCards(state: RulesState, seat: number): Set<string> {
	const keys = new Set<string>();
	for (const move of legalMoves(state, seat)) {
		for (const card of move.cards) keys.add(cardKey(card));
	}

	const req = currentRequirement(state);
	const hand = state.players[seat]?.hand ?? [];
	if (!req || hand.length === 0) return keys;
	if (req.type !== 'sequence' && req.type !== 'doublesequence') return keys;

	const suitsByRank = new Map<number, Set<number>>();
	for (const card of hand) {
		let suits = suitsByRank.get(card.rank);
		if (!suits) {
			suits = new Set<number>();
			suitsByRank.set(card.rank, suits);
		}
		suits.add(card.suit);
	}

	const perRank = req.type === 'sequence' ? 1 : 2;
	const length = req.cards.length / perRank;
	const reqTop = req.cards[req.cards.length - 1];

	for (let lo = 3; lo + length - 1 <= 14; lo++) {
		let complete = true;
		for (let rank = lo; rank < lo + length; rank++) {
			if ((suitsByRank.get(rank)?.size ?? 0) < perRank) {
				complete = false;
				break;
			}
		}
		if (!complete) continue;

		const hi = lo + length - 1;
		const hiSuits = suitsByRank.get(hi)!;
		const canBeat =
			hi > reqTop!.rank ||
			(hi === reqTop!.rank && [...hiSuits].some((s) => s > reqTop!.suit));
		if (!canBeat) continue;

		for (let rank = lo; rank < lo + length; rank++) {
			for (const suit of suitsByRank.get(rank)!) keys.add(`${rank * 4 + suit}`);
		}
	}

	return keys;
}

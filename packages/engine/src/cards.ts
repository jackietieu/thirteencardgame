import type { Card, Rank, Suit } from './types.js';

export const SUIT_GLYPHS: readonly string[] = ['♠', '♣', '♦', '♥'];
export const SUIT_NAMES: readonly string[] = ['Spades', 'Clubs', 'Diamonds', 'Hearts'];

const RANK_LABELS: Record<number, string> = {
  3: '3',
  4: '4',
  5: '5',
  6: '6',
  7: '7',
  8: '8',
  9: '9',
  10: '10',
  11: 'J',
  12: 'Q',
  13: 'K',
  14: 'A',
  15: '2',
};

const RANK_NAMES: Record<number, string> = {
  3: 'Three',
  4: 'Four',
  5: 'Five',
  6: 'Six',
  7: 'Seven',
  8: 'Eight',
  9: 'Nine',
  10: 'Ten',
  11: 'Jack',
  12: 'Queen',
  13: 'King',
  14: 'Ace',
  15: 'Two',
};

/** The 3♠ — leads the first hand of a game and must be included in that first play. */
export const THREE_SPADES: Card = { rank: 3, suit: 0 };
export const DECK: Card[] = (() => {
  const cards: Card[] = [];
  for (let rank = 3; rank <= 15; rank++) {
    for (let suit = 0; suit <= 3; suit++) {
      cards.push({ rank: rank as Rank, suit: suit as Suit });
    }
  }
  return cards;
})();

/** Weak → strong comparison: rank, then suit (hearts highest). > 0 means `a` beats `b`. */
export function cmpCard(a: Card, b: Card): number {
  return a.rank - b.rank || a.suit - b.suit;
}

/** New array sorted weakest → strongest. */
export function sortCards(cards: readonly Card[]): Card[] {
  return [...cards].sort(cmpCard);
}

export function containsCard(cards: readonly Card[], card: Card): boolean {
  return cards.some((c) => c.rank === card.rank && c.suit === card.suit);
}

/** Removes every given card from a hand, returning a new sorted hand. */
export function removeCards(hand: readonly Card[], cards: readonly Card[]): Card[] {
  const kill = new Set(cards.map((c) => c.rank * 4 + c.suit));
  return hand.filter((c) => !kill.has(c.rank * 4 + c.suit));
}

export function rankLabel(rank: Rank): string {
  return RANK_LABELS[rank]!;
}

/** Compact label, e.g. "Q♥". */
export function cardLabel(card: Card): string {
  return `${RANK_LABELS[card.rank]}${SUIT_GLYPHS[card.suit]}`;
}

/** Full spoken name, e.g. "Queen of Hearts" (for aria-labels and logs). */
export function cardName(card: Card): string {
  return `${RANK_NAMES[card.rank]} of ${SUIT_NAMES[card.suit]}`;
}

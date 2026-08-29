import type { Card, Move, PassMove } from './types.js';
import { cardLabel, cmpCard, rankLabel, sortCards } from './cards.js';

/**
 * Classify a set of cards as a legal combination (rule 3), or null if the set
 * is not one. Returned `cards` are sorted ascending (weakest first).
 */
export function classify(cards: readonly Card[]): Move | null {
  const n = cards.length;
  if (n === 0) return null;
  const seen = new Set<number>();
  for (const c of cards) {
    const key = c.rank * 4 + c.suit;
    if (seen.has(key)) return null; // duplicate card
    seen.add(key);
  }
  const s = sortCards(cards);
  if (n === 1) return { type: 'single', cards: s };
  if (n <= 4 && s.every((c) => c.rank === s[0]!.rank)) {
    const type = n === 2 ? 'pair' : n === 3 ? 'triple' : 'fourofakind';
    return { type, cards: s };
  }
  if (n >= 3 && isRun(s)) return { type: 'sequence', cards: s };
  if (n >= 6 && n % 2 === 0 && isDoubleRun(s)) return { type: 'doublesequence', cards: s };
  return null;
}

/** Sorted distinct ranks, consecutive, all ≤ A (no 2s). */
function isRun(s: Card[]): boolean {
  if (s[s.length - 1]!.rank > 14) return false;
  for (let i = 1; i < s.length; i++) {
    if (s[i]!.rank !== s[i - 1]!.rank + 1) return false;
  }
  return true;
}

/** Sorted distinct cards: exactly two of each of 3+ consecutive ranks, all ≤ A. */
function isDoubleRun(s: Card[]): boolean {
  if (s[s.length - 1]!.rank > 14) return false;
  for (let i = 0; i < s.length; i += 2) {
    if (s[i]!.rank !== s[i + 1]!.rank) return false;
    if (i > 0 && s[i]!.rank !== s[i - 1]!.rank + 1) return false;
  }
  return true;
}

/** Highest card of a combo (cards are sorted ascending). */
export function comboTop(move: Move): Card {
  return move.cards[move.cards.length - 1]!;
}

/**
 * Whether `ch` may be played on top of `top`. Both must be classified combos.
 * Rules 4.1–4.2 (same type, same size, higher top card) plus the bomb tiers of
 * rule 5: bombs beat 2s, and a bomb is answered only by a higher bomb of the
 * same family.
 */
export function beats(top: Move, ch: Move): boolean {
  if (top.type === ch.type) {
    switch (top.type) {
      case 'single':
        return cmpCard(comboTop(ch), comboTop(top)) > 0;
      case 'pair':
      case 'triple':
      case 'fourofakind':
        return comboTop(ch).rank > comboTop(top).rank;
      case 'sequence':
        return ch.cards.length === top.cards.length && cmpCard(comboTop(ch), comboTop(top)) > 0;
      case 'doublesequence':
        if (ch.cards.length !== top.cards.length) return ch.cards.length > top.cards.length;
        return cmpCard(comboTop(ch), comboTop(top)) > 0;
    }
  }
  // Cross-type: only bombs over 2s (rules 5.1–5.4).
  if (!top.cards.every((c) => c.rank === 15)) return false;
  const pairs = ch.cards.length / 2;
  if (top.type === 'single') {
    return ch.type === 'fourofakind' || (ch.type === 'doublesequence' && pairs >= 3);
  }
  if (top.type === 'pair') return ch.type === 'doublesequence' && pairs >= 4;
  if (top.type === 'triple') return ch.type === 'doublesequence' && pairs >= 5;
  return false; // four 2s: only a higher four-of-a-kind could answer, none exists
}

/** Short human description, e.g. "single 2♥", "pair of 9s", "run 5-6-7". */
export function describeMove(action: Move | PassMove): string {
  if (action.type === 'pass') return 'pass';
  const top = comboTop(action);
  switch (action.type) {
    case 'single':
      return `single ${cardLabel(action.cards[0]!)}`;
    case 'pair':
      return `pair of ${rankLabel(top.rank)}s`;
    case 'triple':
      return `triple of ${rankLabel(top.rank)}s`;
    case 'fourofakind':
      return `four of a kind, ${rankLabel(top.rank)}s`;
    case 'sequence':
      return `run ${action.cards.map((c) => rankLabel(c.rank)).join('-')}`;
    case 'doublesequence':
      return `double run ${rankLabel(action.cards[0]!.rank)}-${rankLabel(top.rank)} (${action.cards.length / 2} pairs)`;
  }
}

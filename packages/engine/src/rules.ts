import type { Card, GameState, Move, Rank } from './types.js';
import { beats, classify } from './combos.js';
import { containsCard, sortCards, THREE_SPADES } from './cards.js';

export function canAct(state: GameState, seat: number): boolean {
  const player = state.players[seat];
  return (
    state.phase === 'playing' &&
    state.turn === seat &&
    player !== undefined &&
    !player.out &&
    !player.passed
  );
}

/** May pass only mid-trick, at most once per trick, never while leading (rules 6.1–6.3). */
export function canPass(state: GameState, seat: number): boolean {
  return canAct(state, seat) && state.trick.plays.length > 0;
}

/** The combination that must be beaten, or null while the trick is open. */
export function currentRequirement(state: GameState): Move | null {
  const last = state.trick.plays[state.trick.plays.length - 1];
  return last && last.action.type !== 'pass' ? last.action : null;
}

export type MoveError =
  | 'not_playing'
  | 'not_your_turn'
  | 'player_out'
  | 'already_passed'
  | 'invalid_combo'
  | 'does_not_beat'
  | 'opening_requires_3spades';

/** Checks a play against every rule; null means legal. Used by applyMove and the UI. */
export function validateMove(state: GameState, seat: number, move: Move): MoveError | null {
  if (state.phase !== 'playing') return 'not_playing';
  if (state.turn !== seat) return 'not_your_turn';
  if (state.players[seat]!.out) return 'player_out';
  if (state.players[seat]!.passed) return 'already_passed';
  const combo = classify(move.cards);
  if (!combo || combo.type !== move.type) return 'invalid_combo';
  if (state.opening && !containsCard(move.cards, THREE_SPADES)) return 'opening_requires_3spades';
  const top = currentRequirement(state);
  if (top && !beats(top, combo)) return 'does_not_beat';
  return null;
}

/**
 * Every legal play for `seat` right now. Empty list ⇒ the only legal action is
 * a pass. Enumeration is representative per (shape, size, top card) — every
 * achievable top card appears at least once, which is all beating, bots, and
 * highlighting need; exact card selections are validated by `validateMove`.
 */
export function legalMoves(state: GameState, seat: number): Move[] {
  if (!canAct(state, seat)) return [];
  const hand = state.players[seat]!.hand;
  const top = currentRequirement(state);
  if (top) return answers(hand, top);
  const leads = allLeads(hand);
  return state.opening ? leads.filter((m) => containsCard(m.cards, THREE_SPADES)) : leads;
}

// --- enumeration helpers -----------------------------------------------------

/** Cards grouped by rank; groups ascend, cards within a group ascend by suit. */
function byRank(hand: readonly Card[]): Map<Rank, Card[]> {
  const groups = new Map<Rank, Card[]>();
  for (const card of sortCards(hand)) {
    const group = groups.get(card.rank);
    if (group) group.push(card);
    else groups.set(card.rank, [card]);
  }
  return groups;
}

function pick(groups: Map<Rank, Card[]>, rank: number): Card[] {
  return groups.get(rank as Rank) ?? [];
}

function windowFilled(
  groups: Map<Rank, Card[]>,
  start: number,
  length: number,
  minPerRank: number,
): boolean {
  for (let r = start; r < start + length; r++) {
    if (pick(groups, r).length < minPerRank) return false;
  }
  return true;
}

function allSingles(groups: Map<Rank, Card[]>): Move[] {
  const out: Move[] = [];
  for (const cards of groups.values()) {
    for (const card of cards) out.push({ type: 'single', cards: [card] });
  }
  return out;
}

function allPairs(groups: Map<Rank, Card[]>): Move[] {
  const out: Move[] = [];
  for (const cards of groups.values()) {
    for (let i = 0; i < cards.length; i++) {
      for (let j = i + 1; j < cards.length; j++) {
        out.push({ type: 'pair', cards: [cards[i]!, cards[j]!] });
      }
    }
  }
  return out;
}

function allTriples(groups: Map<Rank, Card[]>): Move[] {
  const out: Move[] = [];
  for (const cards of groups.values()) {
    for (let i = 0; i < cards.length; i++) {
      for (let j = i + 1; j < cards.length; j++) {
        for (let k = j + 1; k < cards.length; k++) {
          out.push({ type: 'triple', cards: [cards[i]!, cards[j]!, cards[k]!] });
        }
      }
    }
  }
  return out;
}

function allFours(groups: Map<Rank, Card[]>): Move[] {
  const out: Move[] = [];
  for (const cards of groups.values()) {
    if (cards.length === 4) out.push({ type: 'fourofakind', cards: [...cards] });
  }
  return out;
}

/**
 * Sequences: one representative per (window, top-suit). The top card is the
 * only thing comparisons look at, so every achievable top card is covered;
 * mid ranks take their lowest available suit (3♠ is suit 0, so opening reps
 * include it whenever the window contains rank 3).
 */
function sequences(groups: Map<Rank, Card[]>, exactLength?: number): Move[] {
  const out: Move[] = [];
  const lengths = exactLength !== undefined ? [exactLength] : seq(3, 12);
  for (const length of lengths) {
    for (let start = 3; start + length - 1 <= 14; start++) {
      if (!windowFilled(groups, start, length, 1)) continue;
      const topRank = start + length - 1;
      for (const t of pick(groups, topRank)) {
        const cards: Card[] = [];
        for (let r = start; r < topRank; r++) cards.push(pick(groups, r)[0]!);
        cards.push(t);
        out.push({ type: 'sequence', cards: sortCards(cards) });
      }
    }
  }
  return out;
}

/**
 * Double sequences: two representatives per window — lowest two and highest two
 * suits per rank (the same single rep when every rank has exactly two cards).
 * The high rep's top card is the strongest achievable for the window.
 */
function doubleSequences(groups: Map<Rank, Card[]>, minPairs?: number, exactPairs?: number): Move[] {
  const out: Move[] = [];
  const lengths = exactPairs !== undefined ? [exactPairs] : seq(3, 12);
  for (let pairs of lengths) {
    if (minPairs !== undefined && pairs < minPairs) continue;
    const ranks = pairs;
    for (let start = 3; start + ranks - 1 <= 14; start++) {
      if (!windowFilled(groups, start, ranks, 2)) continue;
      const low: Card[] = [];
      const high: Card[] = [];
      for (let r = start; r < start + ranks; r++) {
        const cs = pick(groups, r);
        low.push(cs[0]!, cs[1]!);
        high.push(cs[cs.length - 2]!, cs[cs.length - 1]!);
      }
      out.push({ type: 'doublesequence', cards: sortCards(low) });
      if (low[0] !== high[0]) out.push({ type: 'doublesequence', cards: sortCards(high) });
    }
  }
  return out;
}

function seq(lo: number, hi: number): number[] {
  const out: number[] = [];
  for (let n = lo; n <= hi; n++) out.push(n);
  return out;
}

function answers(hand: readonly Card[], top: Move): Move[] {
  const groups = byRank(hand);
  switch (top.type) {
    case 'single': {
      const out = allSingles(groups).filter((m) => beats(top, m));
      if (top.cards[0]!.rank === 15) {
        out.push(...allFours(groups));
        out.push(...doubleSequences(groups, 3));
      }
      return out;
    }
    case 'pair': {
      const out = allPairs(groups).filter((m) => beats(top, m));
      if (top.cards[0]!.rank === 15) out.push(...doubleSequences(groups, 4));
      return out;
    }
    case 'triple': {
      const out = allTriples(groups).filter((m) => beats(top, m));
      if (top.cards[0]!.rank === 15) out.push(...doubleSequences(groups, 5));
      return out;
    }
    case 'fourofakind':
      return allFours(groups).filter((m) => beats(top, m));
    case 'sequence':
      return sequences(groups, top.cards.length).filter((m) => beats(top, m));
    case 'doublesequence':
      return doubleSequences(groups).filter((m) => beats(top, m));
  }
}

function allLeads(hand: readonly Card[]): Move[] {
  const groups = byRank(hand);
  return [
    ...allSingles(groups),
    ...allPairs(groups),
    ...allTriples(groups),
    ...allFours(groups),
    ...sequences(groups),
    ...doubleSequences(groups),
  ];
}

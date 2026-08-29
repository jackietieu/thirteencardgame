import type { Action, GameState, Move } from '@thirteen/engine';
import { canPass, cmpCard, comboTop, legalMoves } from '@thirteen/engine';

/** A bot decides the action for its seat. Returning `pass` means decline. */
export type Bot = (state: GameState, seat: number) => Action;

export const PASS: Action = { type: 'pass', cards: [] };

function isBomb(move: Move): boolean {
  return move.type === 'fourofakind' || move.type === 'doublesequence';
}

/**
 * L0 — plays any legal move (and passes a quarter of the time it may pass).
 * Exists as the fuzzer workhorse and the skill floor.
 */
export function randomBot(rng: () => number = Math.random): Bot {
  return (state, seat) => {
    const moves = legalMoves(state, seat);
    if (moves.length === 0) return PASS;
    if (canPass(state, seat) && rng() < 0.25) return PASS;
    return moves[Math.floor(rng() * moves.length)]!;
  };
}

const byTopCard = (a: Move, b: Move) => cmpCard(comboTop(a), comboTop(b));

/**
 * L1 greedy — the v1 default opponent. Sheds the lowest legal cards, leads
 * combos that use the most cards, saves bombs and 2s for when they win a
 * trick or threaten to end the hand.
 */
export function greedyBot(state: GameState, seat: number): Action {
  const moves = legalMoves(state, seat);
  if (moves.length === 0) return PASS;
  const hand = state.players[seat]!.hand;

  const finishing = moves.find((m) => m.cards.length === hand.length);
  if (finishing) return finishing;

  if (state.trick.plays.length === 0) {
    // Don't open with bombs or 2s unless there is nothing else.
    const safe = moves.filter(
      (m) => !isBomb(m) && !(m.type === 'single' && m.cards[0]!.rank === 15),
    );
    const pool = safe.length > 0 ? safe : moves;
    return pool
      .slice()
      .sort((a, b) => b.cards.length - a.cards.length || byTopCard(a, b))[0]!;
  }

  const plain = moves.filter((m) => !isBomb(m));
  const withoutTwos = plain.filter((m) => m.cards.every((c) => c.rank !== 15));
  if (withoutTwos.length > 0) return withoutTwos.slice().sort(byTopCard)[0]!;

  // Beating a 2 with a 2, or a high card late: acceptable once the hand is short.
  if (plain.length > 0 && hand.length <= 6) return plain.slice().sort(byTopCard)[0]!;

  // Only bombs are left (the table shows a 2): spend one only if it nearly ends the hand.
  const bombs = moves.slice().sort((a, b) => a.cards.length - b.cards.length || byTopCard(a, b));
  if (hand.length - bombs[0]!.cards.length <= 2) return bombs[0]!;
  return PASS;
}

import { describe, expect, it } from 'vitest';
import {
  applyMove,
  buildState,
  canPass,
  containsCard,
  createGame,
  legalMoves,
  THREE_SPADES,
  validateMove,
  type Card,
} from '../src/index.js';
import { C, hand } from './helpers.js';

const PASS = { type: 'pass', cards: [] as [] } as const;

describe('rule 2 — deal and opening', () => {
  it('2.1 every hand deals 13 cards', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const game = createGame(seed);
      for (const player of game.players) expect(player.hand).toHaveLength(13);
    }
  });

  it('2.2 the 3♠ holder leads hand 0 with the opening constraint', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const game = createGame(seed);
      const holder = game.players.findIndex((p) => containsCard(p.hand, THREE_SPADES));
      expect(game.turn).toBe(holder);
      expect(game.opening).toBe(true);
      expect(game.handNumber).toBe(0);
      expect(canPass(game, holder)).toBe(false); // leader can never pass
    }
  });

  it('2.3 the opening play must include the 3♠ card itself', () => {
    const game = createGame(1);
    const holder = game.turn;
    const moves = legalMoves(game, holder);
    expect(moves.length).toBeGreaterThan(0);
    for (const move of moves) {
      expect(containsCard(move.cards, THREE_SPADES)).toBe(true);
      expect(validateMove(game, holder, move)).toBeNull();
    }
    expect(moves.some((mv) => mv.type === 'single' && containsCard(mv.cards, THREE_SPADES))).toBe(true);
    // A different single from the holder's hand is rejected.
    const other = game.players[holder]!.hand.find((c) => !containsCard([c], THREE_SPADES))!;
    expect(other).toBeDefined();
    expect(validateMove(game, holder, { type: 'single', cards: [other] })).toBe(
      'opening_requires_3spades',
    );
  });

  it('2.3 the opening constraint lifts after the first play', () => {
    const game = createGame(1);
    const holder = game.turn;
    const next = applyMove(game, holder, { type: 'single', cards: [THREE_SPADES] });
    expect(next.opening).toBe(false);
    expect(next.trick.plays).toHaveLength(1);
    const nextSeat = next.turn;
    const best: Card = next.players[nextSeat]!.hand[next.players[nextSeat]!.hand.length - 1]!;
    expect(validateMove(next, nextSeat, { type: 'single', cards: [best] })).toBeNull();
  });

  it('2.4 from hand 2 on the previous winner leads anything', () => {
    const state = buildState({
      hands: [hand('5♠', '6♦'), hand('K♠', 'K♥', 'K♦', 'K♣'), hand('9♣'), hand('9♦')],
      turn: 1,
      handNumber: 1,
      opening: false,
      lastHandWinner: 1,
      trick: { plays: [], leader: 1 },
    });
    const moves = legalMoves(state, 1);
    expect(moves.some((mv) => mv.type === 'fourofakind')).toBe(true);
    expect(validateMove(state, 1, { type: 'single', cards: [C('K♠')] })).toBeNull();
    expect(validateMove(state, 1, { type: 'pair', cards: [C('K♠'), C('K♥')] })).toBeNull();
  });
});

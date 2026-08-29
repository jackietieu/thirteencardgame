import { describe, expect, it } from 'vitest';
import {
  buildState,
  classify,
  cmpCard,
  createGame,
  describeMove,
  legalMoves,
  validateMove,
  type GameState,
} from '../src/index.js';
import { C, hand } from './helpers.js';

/** Every enumerated move must validate, and every non-trick seat gets none. */
function assertEnumeration(state: GameState): void {
  for (let seat = 0; seat < 4; seat++) {
    const moves = legalMoves(state, seat);
    if (seat !== state.turn) {
      expect(moves).toEqual([]);
      continue;
    }
    for (const move of moves) {
      expect(validateMove(state, seat, move)).toBeNull();
      expect(classify(move.cards)!.type).toBe(move.type);
    }
  }
}

describe('legalMoves enumeration', () => {
  it('enumerates only valid moves across 30 fresh deals', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const game = createGame(seed);
      assertEnumeration(game);
    }
  });

  it('opening moves all contain the 3♠ and include the single 3♠', () => {
    const game = createGame(5);
    const moves = legalMoves(game, game.turn);
    expect(moves.length).toBeGreaterThan(1);
    expect(moves.some((m) => m.type === 'single' && m.cards[0]!.rank === 3 && m.cards[0]!.suit === 0)).toBe(true);
  });

  it('leads include every combination family when the hand has them', () => {
    const state = buildState({
      hands: [hand('3♠', '3♥', '4♠', '4♥', '5♠', '5♥', '9♦', 'K♣', 'K♠', 'K♥', 'K♦', '2♦', 'A♠')],
      turn: 0,
      handNumber: 1,
    });
    const types = new Set(legalMoves(state, 0).map((m) => m.type));
    for (const t of ['single', 'pair', 'triple', 'fourofakind', 'sequence', 'doublesequence']) {
      expect(types.has(t as never)).toBe(true);
    }
  });

  it('a single 2 can be answered by higher singles, any 4oak, or DS 3+', () => {
    const state = buildState({
      hands: [hand('2♠', '2♦', '2♥', '3♠', '3♥', '4♠', '4♥', '5♠', '5♥', '9♦', '9♥', '9♣', '9♠')],
      turn: 0,
      handNumber: 1,
      trick: { plays: [{ seat: 1, action: { type: 'single', cards: [C('2♣')] } }], leader: 1 },
    });
    const moves = legalMoves(state, 0);
    expect(moves.some((m) => m.type === 'fourofakind')).toBe(true);
    expect(moves.some((m) => m.type === 'doublesequence')).toBe(true);
    expect(moves.some((m) => m.type === 'single' && m.cards[0]!.rank === 15)).toBe(true);
    expect(moves.every((m) => m.type !== 'sequence')).toBe(true);
  });

  it('a pair of 2s can only be answered by double sequence 4+', () => {
    const state = buildState({
      hands: [hand('3♠', '3♥', '4♠', '4♥', '5♠', '5♥', '6♠', '6♥', '2♠', '2♥', '9♦', '9♥', 'A♠')],
      turn: 0,
      handNumber: 1,
      trick: {
        plays: [{ seat: 1, action: { type: 'pair', cards: [C('2♦'), C('2♣')] } }],
        leader: 1,
      },
    });
    const moves = legalMoves(state, 0);
    expect(moves.length).toBe(1);
    expect(moves[0]!.type).toBe('doublesequence');
    expect(moves[0]!.cards).toHaveLength(8);
  });

  it('a triple of 2s can only be answered by double sequence 5+', () => {
    const state = buildState({
      hands: [
        hand('3♠', '3♥', '4♠', '4♥', '5♠', '5♥', '6♠', '6♥', '7♠', '7♥'),
        hand('2♠', '2♥', '2♦'),
      ],
      turn: 0,
      handNumber: 1,
      trick: {
        plays: [{ seat: 1, action: { type: 'triple', cards: [C('2♠'), C('2♥'), C('2♦')] } }],
        leader: 1,
      },
    });
    const moves = legalMoves(state, 0);
    expect(moves.length).toBe(1);
    expect(moves[0]!.type).toBe('doublesequence');
    expect(moves[0]!.cards).toHaveLength(10);
  });

  it('sequence answers lock to the same length with a higher top card', () => {
    const state = buildState({
      hands: [hand('5♠', '6♠', '7♠', '8♠', '9♠', '4♠', '6♥', '7♥', '8♥'), hand('5♥', '6♦', '7♦')],
      turn: 0,
      handNumber: 1,
      trick: {
        plays: [{ seat: 1, action: { type: 'sequence', cards: hand('5♦', '6♦', '7♦') } }],
        leader: 1,
      },
    });
    const moves = legalMoves(state, 0);
    expect(moves.length).toBeGreaterThan(0);
    for (const move of moves) {
      expect(move.type).toBe('sequence');
      expect(move.cards).toHaveLength(3);
      expect(cmpCard(move.cards[move.cards.length - 1]!, C('7♦'))).toBeGreaterThan(0);
    }
    expect(moves.some((m) => m.cards.length === 5)).toBe(false);
  });

  it('a double sequence can be answered by longer or equal-length-higher (5.5)', () => {
    const state = buildState({
      hands: [
        hand('3♠', '3♥', '4♠', '4♥', '5♠', '5♥', '6♠', '6♥', '7♠', '7♥', '8♠', '8♥', 'K♠'),
      ],
      turn: 0,
      handNumber: 1,
      trick: {
        plays: [
          { seat: 1, action: { type: 'doublesequence', cards: hand('4♠', '4♥', '5♠', '5♥', '6♠', '6♥') } },
        ],
        leader: 1,
      },
    });
    const moves = legalMoves(state, 0);
    const lens = moves.map((m) => m.cards.length);
    expect(lens).toContain(6); // same length, higher top (7♥ beats 6♥)
    expect(lens).toContain(10); // longer
    expect(lens.every((l) => l >= 6)).toBe(true);
  });

  it('passed and finished players get no moves', () => {
    const state = buildState({
      hands: [hand('3♠'), hand('9♦'), hand('A♣'), hand('2♥')],
      turn: 2,
      handNumber: 1,
      trick: { plays: [{ seat: 1, action: { type: 'single', cards: [C('9♦')] } }], leader: 1 },
    });
    expect(legalMoves(state, 0)).toEqual([]);
    expect(legalMoves(state, 1)).toEqual([]);
    expect(legalMoves(state, 2).length).toBeGreaterThan(0);
  });

  it('describeMove renders human sentences', () => {
    expect(describeMove({ type: 'single', cards: [C('2♥')] })).toBe('single 2♥');
    expect(describeMove({ type: 'pair', cards: hand('9♠', '9♥') })).toBe('pair of 9s');
    expect(describeMove({ type: 'sequence', cards: hand('5♠', '6♦', '7♥') })).toBe('run 5-6-7');
    expect(describeMove({ type: 'pass', cards: [] })).toBe('pass');
  });
});


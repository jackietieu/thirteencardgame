import { describe, expect, it } from 'vitest';
import {
  applyMove,
  createGame,
  EngineError,
  legalMoves,
  nextHand,
  THREE_SPADES,
  validateMove,
} from '../src/index.js';

describe('state engine', () => {
  it('createGame is deterministic for a given seed', () => {
    expect(JSON.stringify(createGame(7))).toBe(JSON.stringify(createGame(7)));
    const a = createGame(1);
    const b = createGame(2);
    expect(JSON.stringify(a.players)).not.toBe(JSON.stringify(b.players));
  });

  it('createGame without a seed still deals a valid game', () => {
    const game = createGame();
    expect(game.turn).toBeGreaterThanOrEqual(0);
    expect(game.opening).toBe(true);
    for (const player of game.players) expect(player.hand).toHaveLength(13);
  });

  it('rejects actions from the wrong seat', () => {
    const game = createGame(1);
    const other = (game.turn + 1) % 4;
    const card = game.players[other]!.hand[0]!;
    expect(() => applyMove(game, other, { type: 'single', cards: [card] })).toThrowError(
      expect.objectContaining({ code: 'not_your_turn' }),
    );
  });

  it('rejects passing while leading', () => {
    const game = createGame(1);
    expect(() => applyMove(game, game.turn, { type: 'pass', cards: [] })).toThrowError(
      expect.objectContaining({ code: 'cannot_pass' }),
    );
  });

  it('applyMove never mutates its input', () => {
    const game = createGame(1);
    const holder = game.turn;
    const snapshot = JSON.stringify(game);
    applyMove(game, holder, { type: 'single', cards: [THREE_SPADES] });
    expect(JSON.stringify(game)).toBe(snapshot);
  });

  it('nextHand rejects a state that is still playing', () => {
    const game = createGame(1);
    expect(() => nextHand(game)).toThrowError(expect.objectContaining({ code: 'not_hand_over' }));
  });

  it('validateMove reports machine-readable codes', () => {
    const game = createGame(1);
    const holder = game.turn;
    const junk = [
      ...game.players[holder]!.hand.slice(0, 2).filter((c) => !validateEquals3S(c)),
    ];
    expect(junk.length).toBeGreaterThan(0);
    expect(validateMove(game, holder, { type: 'pair', cards: junk })).toBe('invalid_combo');
  });

  it('every seat with the turn has either moves or a legal pass', () => {
    const game = createGame(1);
    const moves = legalMoves(game, game.turn);
    expect(moves.length).toBeGreaterThan(0);
    const other = (game.turn + 1) % 4;
    expect(legalMoves(game, other)).toEqual([]);
  });
});

function validateEquals3S(c: { rank: number; suit: number }): boolean {
  return c.rank === 3 && c.suit === 0;
}

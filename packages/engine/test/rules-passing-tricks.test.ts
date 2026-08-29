import { describe, expect, it } from 'vitest';
import {
  applyMove,
  buildState,
  canPass,
  legalMoves,
  type Action,
  type GameState,
} from '../src/index.js';
import { C, hand } from './helpers.js';

const PASS: Action = { type: 'pass', cards: [] };
const single = (label: string) => ({ type: 'single' as const, cards: [C(label)] });

describe('rule 6 — passing', () => {
  it('6.1 the leader can never pass', () => {
    const state = buildState({
      hands: [hand('3♠'), hand('5♦'), hand('9♣'), hand('K♠')],
      turn: 0,
    });
    expect(state.trick.plays).toHaveLength(0);
    expect(canPass(state, 0)).toBe(false);
    expect(() => applyMove(state, 0, PASS)).toThrowError(
      expect.objectContaining({ code: 'cannot_pass' }),
    );
  });

  it('6.2 a player may pass and the turn skips to the next player', () => {
    const state = buildState({
      hands: [hand('9♣'), hand('7♦'), hand('K♠'), hand('4♦')],
      turn: 0,
      handNumber: 1,
      trick: { plays: [{ seat: 1, action: { type: 'single', cards: [C('7♦')] } }], leader: 1 },
    });
    expect(canPass(state, 0)).toBe(true);
    expect(legalMoves(state, 0).some((m) => m.type === 'single')).toBe(true); // could also beat
    const next = applyMove(state, 0, PASS);
    expect(next.players[0]!.passed).toBe(true);
    expect(next.turn).toBe(1); // P1 is still in the trick (they played the 7♦)
  });

  it('6.3 passing locks a player out until the trick clears', () => {
    let state = buildState({
      hands: [hand('5♠', '9♦'), hand('8♣'), hand('7♦', 'K♠'), hand('3♦')],
      turn: 0,
      handNumber: 1,
    });
    state = applyMove(state, 0, single('5♠')); // P0 leads
    state = applyMove(state, 1, PASS); // P1 locks out
    expect(state.turn).toBe(2);
    state = applyMove(state, 2, single('7♦')); // new play does NOT unlock P1
    expect(state.players[1]!.passed).toBe(true);
    state = applyMove(state, 3, PASS);
    expect(state.turn).toBe(0); // P1 skipped even though the play changed
    expect(state.players[1]!.passed).toBe(true);
    state = applyMove(state, 0, PASS); // everyone else passed → trick clears
    expect(state.trick.plays).toHaveLength(0);
    expect(state.turn).toBe(2);
    expect(state.players.map((p) => p.passed)).toEqual([false, false, false, false]);
  });
});

describe('rule 7 — trick resolution', () => {
  it('7.1/7.2 the trick clears when all others pass; the last play wins and leads', () => {
    let state = buildState({
      hands: [hand('5♠', '9♦'), hand('8♣'), hand('7♦', 'K♠'), hand('3♦')],
      turn: 0,
      handNumber: 1,
    });
    state = applyMove(state, 0, single('5♠'));
    state = applyMove(state, 1, PASS);
    state = applyMove(state, 2, single('7♦'));
    state = applyMove(state, 3, PASS);
    state = applyMove(state, 0, PASS);
    expect(state.phase).toBe('playing');
    expect(state.lastTrick!.plays).toHaveLength(2); // passes are not recorded as plays
    expect(state.lastTrick!.leader).toBe(2); // 7♦ was the last play
    expect(state.turn).toBe(2); // winner leads
    expect(state.trick.leader).toBe(2);
    expect(state.trick.plays).toHaveLength(0);
  });

  it('7.3 if the winner is out, the lead skips to the next player with cards', () => {
    let state = buildState({
      hands: [[], hand('2♥'), hand('5♣', '9♦'), hand('4♠')],
      turn: 1,
      handNumber: 1,
      finished: [0],
      lastHandWinner: 0,
      trick: { plays: [], leader: 1 },
    });
    state = applyMove(state, 1, single('2♥'));
    expect(state.players[1]!.out).toBe(true);
    expect(state.finished).toEqual([0, 1]);
    expect(state.phase).toBe('playing'); // only two players have gone out
    state = applyMove(state, 2, PASS);
    state = applyMove(state, 3, PASS);
    expect(state.trick.plays).toHaveLength(0);
    expect(state.turn).toBe(2); // next clockwise after P1 with cards
    expect(state.trick.leader).toBe(2);
  });

  it('a hand is not over while fewer than three players are out', () => {
    let state = buildState({
      hands: [[], hand('2♥'), hand('5♣', '9♦'), hand('4♠')],
      turn: 1,
      handNumber: 1,
      finished: [0],
      lastHandWinner: 0,
      trick: { plays: [], leader: 1 },
    });
    state = applyMove(state, 1, single('2♥'));
    expect(state.phase).toBe('playing');
  });
});

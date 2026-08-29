import { describe, expect, it } from 'vitest';
import {
  applyMove,
  buildState,
  createGame,
  nextHand,
  type Action,
  type GameState,
} from '../src/index.js';
import { C, hand } from './helpers.js';

const single = (label: string): Action => ({ type: 'single', cards: [C(label)] });

/** Two players already out; P2 can finish the hand with one play. */
function nearEndState(scores: number[]): GameState {
  return buildState({
    hands: [[], [], hand('Q♠'), hand('A♣', '4♦')],
    turn: 2,
    handNumber: 3,
    opening: false,
    scores: [...scores],
    finished: [0, 1],
    lastHandWinner: 0,
    trick: { plays: [], leader: 2 },
  });
}

describe('rule 8 — hand end and scoring', () => {
  it('8.1 the hand ends the instant the third player sheds out', () => {
    const state = applyMove(nearEndState([0, 0, 0, 0]), 2, single('Q♠'));
    expect(state.phase).toBe('handOver');
    expect(state.turn).toBe(-1);
    expect(state.finished).toEqual([0, 1, 2, 3]);
    expect(state.players[2]!.out).toBe(true);
  });

  it('8.2 placings score 3/2/1/0 accumulated across hands', () => {
    const state = applyMove(nearEndState([3, 2, 1, 0]), 2, single('Q♠'));
    expect(state.scores).toEqual([6, 4, 2, 0]);
    expect(state.lastHandWinner).toBe(0); // P0 finished first earlier in this hand
  });

  it('8.x hand-end takes priority over any pending trick action', () => {
    const state = buildState({
      hands: [[], [], hand('Q♠'), hand('A♣', '4♦')],
      turn: 2,
      handNumber: 3,
      finished: [0, 1],
      lastHandWinner: 2,
      trick: { plays: [], leader: 2 },
    });
    const next = applyMove(state, 2, single('Q♠'));
    expect(next.phase).toBe('handOver'); // P3 never gets to respond
  });
});

describe('rule 9 — game end', () => {
  it('9.1 a sole leader at 10+ wins the game', () => {
    const state = applyMove(nearEndState([9, 2, 1, 0]), 2, single('Q♠'));
    expect(state.phase).toBe('gameOver');
    expect(state.winner).toBe(0);
    expect(state.scores).toEqual([12, 4, 2, 0]);
  });

  it('9.1 a tie at 10+ does not end the game', () => {
    const state = buildState({
      hands: [[], [], hand('Q♠'), hand('A♣', '4♦')],
      turn: 2,
      handNumber: 3,
      scores: [7, 8, 0, 0],
      finished: [0, 1],
      lastHandWinner: 0,
      trick: { plays: [], leader: 2 },
    });
    const next = applyMove(state, 2, single('Q♠'));
    expect(next.scores).toEqual([10, 10, 1, 0]);
    expect(next.phase).toBe('handOver');
    expect(next.winner).toBeNull();
  });

  it('9.2 otherwise the previous winner leads the next hand with a fresh deal', () => {
    let state = applyMove(nearEndState([1, 1, 1, 1]), 2, single('Q♠'));
    expect(state.phase).toBe('handOver');
    const next = nextHand(state);
    expect(next.phase).toBe('playing');
    expect(next.handNumber).toBe(4);
    expect(next.opening).toBe(false);
    expect(next.turn).toBe(0); // lastHandWinner
    for (const player of next.players) expect(player.hand).toHaveLength(13);
    expect(next.scores).toEqual(state.scores);
  });

  it('9.x no further action is accepted between hands', () => {
    const state = applyMove(nearEndState([0, 0, 0, 0]), 2, single('Q♠'));
    expect(() => applyMove(state, 3, single('A♣'))).toThrowError(
      expect.objectContaining({ code: 'not_playing' }),
    );
  });
});

import type { Card, GameState, Phase, Trick } from './types.js';
import { sortCards } from './cards.js';

export interface BuildStateOptions {
  /** One hand per seat; hands are sorted and emptied hands mark the seat out. */
  hands: Card[][];
  turn?: number;
  handNumber?: number;
  opening?: boolean;
  scores?: number[];
  phase?: Phase;
  trick?: Trick;
  lastTrick?: Trick | null;
  finished?: number[];
  lastHandWinner?: number | null;
  winner?: number | null;
}

/**
 * Builds a GameState directly from dealt hands — for tests and UI/E2E
 * scenarios that need a controlled board rather than a random deal.
 */
export function buildState(options: BuildStateOptions): GameState {
  const turn = options.turn ?? -1;
  return {
    players: options.hands.map((hand) => ({
      hand: sortCards(hand),
      out: hand.length === 0,
      passed: false,
    })),
    turn,
    trick: options.trick ?? { plays: [], leader: turn },
    lastTrick: options.lastTrick ?? null,
    handNumber: options.handNumber ?? 0,
    opening: options.opening ?? false,
    scores: options.scores ?? [0, 0, 0, 0],
    phase: options.phase ?? 'playing',
    finished: options.finished ?? [],
    lastHandWinner: options.lastHandWinner ?? null,
    winner: options.winner ?? null,
    rngState: 0,
  };
}

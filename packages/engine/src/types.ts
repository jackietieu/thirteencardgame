/** Suit order (low → high): 0 = ♠ spades, 1 = ♣ clubs, 2 = ♦ diamonds, 3 = ♥ hearts. */
export type Suit = 0 | 1 | 2 | 3;

/**
 * Rank order (low → high): 3–10, then 11 = J, 12 = Q, 13 = K, 14 = A, 15 = 2.
 * The 2 is the highest rank.
 */
export type Rank = 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15;

export interface Card {
  rank: Rank;
  suit: Suit;
}

export type ComboType =
  | 'single'
  | 'pair'
  | 'triple'
  | 'fourofakind'
  | 'sequence'
  | 'doublesequence';

/** A played combination. `cards` is always sorted ascending (weakest first). */
export interface Move {
  type: ComboType;
  cards: Card[];
}

export interface PassMove {
  type: 'pass';
  cards: [];
}

export type Action = Move | PassMove;

export interface PlayerState {
  /** Cards remaining, sorted ascending. */
  hand: Card[];
  out: boolean;
  /** Has passed the current trick (locks the player out until the trick clears). */
  passed: boolean;
}

export interface TrickPlay {
  seat: number;
  action: Action;
}

/** `plays.length === 0` means the leader is free to play any combination. */
export interface Trick {
  plays: TrickPlay[];
  /** Seat of the current top play (or the leader while the trick is empty). */
  leader: number;
}

export type Phase = 'playing' | 'handOver' | 'gameOver';

export interface GameState {
  players: PlayerState[];
  /** Seat that must act now, or -1 between hands. */
  turn: number;
  trick: Trick;
  /** Last completed trick (for display), or null before any trick has finished. */
  lastTrick: Trick | null;
  /** 0-based. The 3♠ opening only applies on hand 0. */
  handNumber: number;
  /** True until the very first play of the game; that play must include the 3♠. */
  opening: boolean;
  scores: number[];
  phase: Phase;
  /** Seats in the order they finished the current hand. */
  finished: number[];
  lastHandWinner: number | null;
  winner: number | null;
  /** PRNG state, carried in the state so deals replay identically everywhere. */
  rngState: number;
}

export class EngineError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = 'EngineError';
  }
}

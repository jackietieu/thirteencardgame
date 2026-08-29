import type { Action, Card, GameState, PlayerState, Trick } from './types.js';
import { EngineError } from './types.js';
import { validateMove, type MoveError } from './rules.js';
import { containsCard, removeCards, sortCards, THREE_SPADES, DECK } from './cards.js';
import { shuffleInPlace } from './rng.js';

const POINTS = [3, 2, 1, 0] as const;

const ERROR_MESSAGES: Record<
  MoveError | 'cannot_pass' | 'not_hand_over' | 'no_leader' | 'no_seat_to_act',
  string
> = {
  not_playing: 'The hand is not in progress.',
  not_your_turn: 'It is not this player’s turn.',
  player_out: 'This player has no cards left.',
  already_passed: 'This player already passed this trick.',
  invalid_combo: 'That selection is not a valid combination.',
  does_not_beat: 'That combination does not beat the current play.',
  opening_requires_3spades: 'The first play of the game must include the 3♠.',
  cannot_pass: 'The leader must play a combination.',
  not_hand_over: 'The previous hand is still in progress.',
  no_leader: 'No winner recorded for the previous hand.',
  no_seat_to_act: 'Unreachable: no player can act.',
};

/** Deals a fresh 4-player game. `seed` makes the whole game deterministic. */
export function createGame(seed?: number): GameState {
  const rngState = (seed ?? Math.floor(Math.random() * 0x1_0000_0000)) >>> 0;
  const dealt = deal(rngState);
  const holder = dealt.hands.findIndex((hand) => containsCard(hand, THREE_SPADES));
  return {
    players: dealt.hands.map((hand) => ({ hand, out: false, passed: false })),
    turn: holder,
    trick: { plays: [], leader: holder },
    lastTrick: null,
    handNumber: 0,
    opening: true,
    scores: [0, 0, 0, 0],
    phase: 'playing',
    finished: [],
    lastHandWinner: null,
    winner: null,
    rngState: dealt.rngState,
  };
}

/** Starts the next hand after a completed one; the previous winner leads (rule 2.4). */
export function nextHand(prev: GameState): GameState {
  if (prev.phase !== 'handOver') {
    throw new EngineError('not_hand_over', ERROR_MESSAGES.not_hand_over);
  }
  if (prev.lastHandWinner === null) {
    throw new EngineError('no_leader', ERROR_MESSAGES.no_leader);
  }
  const dealt = deal(prev.rngState);
  const leader = prev.lastHandWinner;
  return {
    players: dealt.hands.map((hand) => ({ hand, out: false, passed: false })),
    turn: leader,
    trick: { plays: [], leader },
    lastTrick: null,
    handNumber: prev.handNumber + 1,
    opening: false,
    scores: [...prev.scores],
    phase: 'playing',
    finished: [],
    lastHandWinner: leader,
    winner: prev.winner,
    rngState: dealt.rngState,
  };
}

/**
 * Applies an action (a combination or a pass) for `seat`, enforcing every rule
 * in RULES.md. Returns a new state; throws EngineError on any illegal action.
 */
export function applyMove(state: GameState, seat: number, action: Action): GameState {
  if (state.phase !== 'playing') {
    throw new EngineError('not_playing', ERROR_MESSAGES.not_playing);
  }
  if (seat !== state.turn) {
    throw new EngineError('not_your_turn', ERROR_MESSAGES.not_your_turn);
  }
  const player = state.players[seat]!;
  if (player.out) throw new EngineError('player_out', ERROR_MESSAGES.player_out);
  if (player.passed) throw new EngineError('already_passed', ERROR_MESSAGES.already_passed);

  if (action.type === 'pass') {
    if (state.trick.plays.length === 0) {
      throw new EngineError('cannot_pass', ERROR_MESSAGES.cannot_pass);
    }
  } else {
    const error = validateMove(state, seat, action);
    if (error !== null) throw new EngineError(error, ERROR_MESSAGES[error]);
  }

  const players = state.players.map((p) => ({ hand: [...p.hand], out: p.out, passed: p.passed }));
  const trick: Trick = { plays: [...state.trick.plays], leader: state.trick.leader };
  const next: GameState = {
    ...state,
    players,
    trick,
    scores: [...state.scores],
    finished: [...state.finished],
  };

  if (action.type === 'pass') {
    players[seat]!.passed = true;
  } else {
    players[seat]!.hand = removeCards(players[seat]!.hand, action.cards);
    if (players[seat]!.hand.length === 0) {
      players[seat]!.out = true;
      next.finished.push(seat);
    }
    trick.plays.push({ seat, action });
    trick.leader = seat;
    next.opening = false;
  }

  // Hand ends the instant the third player sheds out (rule 8.1).
  if (players.filter((p) => p.out).length === 3) {
    const last = players.findIndex((p) => !p.out);
    const order = [...next.finished, last];
    order.forEach((finishedSeat, place) => {
      next.scores[finishedSeat] = (next.scores[finishedSeat] ?? 0) + POINTS[place]!;
    });
    next.finished = order;
    next.lastHandWinner = order[0]!;
    next.phase = 'handOver';
    next.turn = -1;
    const best = Math.max(...next.scores);
    if (best >= 10 && next.scores.filter((score) => score === best).length === 1) {
      next.phase = 'gameOver';
      next.winner = next.scores.indexOf(best);
    }
    return next;
  }

  // Trick clears once every other active player has passed (rules 7.1–7.3).
  if (trick.plays.length > 0) {
    const others = [0, 1, 2, 3].filter((s) => !players[s]!.out && s !== trick.leader);
    if (others.length > 0 && others.every((s) => players[s]!.passed)) {
      next.lastTrick = { plays: trick.plays, leader: trick.leader };
      let winner = trick.leader;
      if (players[winner]!.out) winner = nextSeat(players, winner, (p) => !p.out);
      next.trick = { plays: [], leader: winner };
      next.turn = winner;
      for (const p of players) p.passed = false;
      return next;
    }
  }

  next.turn = nextSeat(players, seat, (p) => !p.out && !p.passed);
  return next;
}

function deal(rngState: number): { hands: Card[][]; rngState: number } {
  const cards = [...DECK];
  const nextRng = shuffleInPlace(cards, rngState);
  const hands: Card[][] = [[], [], [], []];
  cards.forEach((card, i) => hands[i % 4]!.push(card));
  return { hands: hands.map((hand) => sortCards(hand)), rngState: nextRng };
}

/** Next seat clockwise from `from` satisfying `ok`. */
function nextSeat(players: PlayerState[], from: number, ok: (p: PlayerState) => boolean): number {
  for (let i = 1; i <= 4; i++) {
    const seat = (from + i) % 4;
    if (ok(players[seat]!)) return seat;
  }
  throw new EngineError('no_seat_to_act', ERROR_MESSAGES.no_seat_to_act);
}

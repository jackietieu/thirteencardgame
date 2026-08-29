import type { Card, Rank, Suit } from '../src/index.js';

const RANKS: Record<string, Rank> = {
  '3': 3,
  '4': 4,
  '5': 5,
  '6': 6,
  '7': 7,
  '8': 8,
  '9': 9,
  '10': 10,
  J: 11,
  Q: 12,
  K: 13,
  A: 14,
  '2': 15,
};

const SUITS: Record<string, Suit> = { '♠': 0, '♣': 1, '♦': 2, '♥': 3 };

/** Parses card shorthand, e.g. C('Q♥'), C('10♦'). */
export function C(label: string): Card {
  const rank = RANKS[label.slice(0, -1)]!;
  const suit = SUITS[label.slice(-1)]!;
  return { rank, suit };
}

export function hand(...labels: string[]): Card[] {
  return labels.map(C);
}

/** Deterministic RNG for fuzz/bot tests, from an integer seed. */
export function mulberry(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    // Matches the engine's mulberry32 stepping (packages/engine/src/rng.ts).
    const a = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    state = a;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

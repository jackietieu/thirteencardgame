/**
 * Deterministic PRNG (mulberry32). The state lives inside GameState, so a
 * seeded game replays identically no matter where the engine runs.
 */
export type RngState = number;

/** One mulberry32 step: advances the state and yields a float in [0, 1). */
export function rngStep(state: number): { state: number; float: number } {
  const a = (state + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return { state: a, float: ((t ^ (t >>> 14)) >>> 0) / 4294967296 };
}

/** In-place Fisher–Yates driven by the stepped PRNG. Returns the new RNG state. */
export function shuffleInPlace<T>(items: T[], rngState: number): number {
  let s = rngState;
  for (let i = items.length - 1; i > 0; i--) {
    const step = rngStep(s);
    s = step.state;
    const j = Math.floor(step.float * (i + 1));
    const tmp = items[i]!;
    items[i] = items[j]!;
    items[j] = tmp;
  }
  return s;
}

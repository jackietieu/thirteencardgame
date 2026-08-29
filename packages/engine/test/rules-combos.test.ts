import { describe, expect, it } from 'vitest';
import { classify } from '../src/index.js';
import { hand } from './helpers.js';

const combo = (...labels: string[]) => classify(hand(...labels));

describe('rule 3 — combinations', () => {
  it('3.1 single', () => {
    expect(combo('9♦')!.type).toBe('single');
    expect(combo('2♥')!.type).toBe('single');
  });

  it('3.2 pair — same rank only', () => {
    expect(combo('9♠', '9♥')!.type).toBe('pair');
    expect(combo('9♠', '10♥')).toBeNull();
  });

  it('3.3 triple', () => {
    expect(combo('9♠', '9♥', '9♦')!.type).toBe('triple');
    expect(combo('9♠', '9♥', '10♦')).toBeNull();
  });

  it('3.4 four-of-a-kind', () => {
    expect(combo('9♠', '9♥', '9♦', '9♣')!.type).toBe('fourofakind');
    expect(combo('9♠', '9♥', '9♦')!.type).toBe('triple');
  });

  it('3.5 sequence — 3+ consecutive ranks, no 2s', () => {
    expect(combo('3♠', '4♥', '5♦')!.type).toBe('sequence');
    expect(combo('Q♠', 'K♥', 'A♦')!.type).toBe('sequence'); // Q-K-A ok
    expect(combo('K♠', 'A♥', '2♦')).toBeNull(); // K-A-2 not
    expect(combo('A♠', '2♥', '3♦')).toBeNull(); // A-2-3 not
    expect(combo('J♠', 'Q♥')).toBeNull(); // too short
    expect(combo('3♠', '4♥', '6♦')).toBeNull(); // gap
    expect(combo('3♠', '3♥', '4♦')).toBeNull(); // repeated rank
  });

  it('3.6 double sequence — 3+ consecutive pairs, no 2s', () => {
    expect(combo('3♠', '3♥', '4♠', '4♥', '5♠', '5♥')!.type).toBe('doublesequence');
    expect(combo('2♠', '2♥', '3♠', '3♥', '4♠', '4♥')).toBeNull(); // contains 2s
    expect(combo('3♠', '3♥', '4♠', '4♥')).toBeNull(); // only two pairs
    expect(combo('3♠', '3♥', '4♠', '5♥', '5♠', '6♦')).toBeNull(); // uneven groups
  });

  it('duplicate cards are never a combination', () => {
    expect(combo('9♠', '9♠')).toBeNull();
  });

  it('empty selection is not a combination', () => {
    expect(classify([])).toBeNull();
  });
});

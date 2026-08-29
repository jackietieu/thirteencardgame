import { describe, expect, it } from 'vitest';
import { beats, classify } from '../src/index.js';
import { hand } from './helpers.js';

const m = (...labels: string[]) => classify(hand(...labels))!;

describe('rule 4 — beating', () => {
  it('4.1 same type, same size, higher top card', () => {
    expect(beats(m('9♦'), m('10♣'))).toBe(true);
    expect(beats(m('10♣'), m('9♦'))).toBe(false);
    expect(beats(m('9♠'), m('9♥'))).toBe(true); // suit tie-break on singles
    expect(beats(m('8♦', '8♥'), m('9♠', '9♦'))).toBe(true);
    expect(beats(m('9♠', '9♥'), m('9♦', '9♣'))).toBe(false); // equal-rank pair never beats
    expect(beats(m('5♠', '6♦', '7♣'), m('5♠', '6♦', '7♥'))).toBe(true); // top-card suit
    expect(beats(m('5♠', '6♦', '7♥'), m('5♣', '6♣', '7♠'))).toBe(false);
    expect(beats(m('3♠', '4♠', '5♠', '6♠'), m('4♦', '5♦', '6♦', '7♥'))).toBe(true);
  });

  it('4.1 sequence length is locked (a 5-run never beats a 4-run)', () => {
    const four = m('4♠', '5♠', '6♠', '7♠');
    const five = m('3♠', '4♠', '5♠', '6♠', '7♠');
    expect(beats(five, m('8♠', '9♠', '10♠', 'J♠', 'Q♠'))).toBe(true);
    expect(beats(four, five)).toBe(false);
    expect(beats(five, four)).toBe(false);
  });

  it('4.2 nothing else beats anything', () => {
    expect(beats(m('9♦'), m('9♠', '9♥'))).toBe(false); // pair vs single
    expect(beats(m('9♦', '9♥', '9♣'), m('10♠', '10♦'))).toBe(false); // pair vs triple
    expect(beats(m('5♠', '6♦', '7♣'), m('3♠', '3♥', '3♦', '3♣'))).toBe(false); // 4oak vs run
    expect(beats(m('9♦'), m('3♠', '3♥', '3♦', '3♣'))).toBe(false); // 4oak only chops 2s
    expect(beats(m('K♠'), m('3♠', '3♥', '4♠', '4♥', '5♠', '5♥'))).toBe(false); // DS only chops 2s
  });
});

describe('rule 5 — bombs', () => {
  it('5.1 four-of-a-kind or double sequence 3+ beats a single 2', () => {
    expect(beats(m('2♠'), m('7♠', '7♥', '7♦', '7♣'))).toBe(true);
    expect(beats(m('2♥'), m('3♠', '3♥'))).toBe(false); // pair is not a bomb
    expect(beats(m('2♠'), m('3♠', '3♥', '4♠', '4♥', '5♠', '5♥'))).toBe(true);
    expect(beats(m('2♥'), m('5♠', '5♥', '6♠', '6♥', '7♠', '7♥'))).toBe(true);
  });

  it('5.2 double sequence 4+ beats a pair of 2s', () => {
    expect(beats(m('2♠', '2♥'), m('3♠', '3♥', '4♠', '4♥', '5♠', '5♥', '6♠', '6♥'))).toBe(true);
    expect(beats(m('2♠', '2♥'), m('3♠', '3♥', '4♠', '4♥', '5♠', '5♥'))).toBe(false);
    expect(beats(m('2♠', '2♥'), m('7♠', '7♥', '8♠', '8♥', '9♠', '9♥', '10♠', '10♥'))).toBe(true);
  });

  it('5.3 double sequence 5+ beats a triple of 2s', () => {
    const fivePairs = '3♠ 3♥ 4♠ 4♥ 5♠ 5♥ 6♠ 6♥ 7♠ 7♥'.split(' ');
    const fourPairs = '3♠ 3♥ 4♠ 4♥ 5♠ 5♥ 6♠ 6♥'.split(' ');
    expect(beats(m('2♠', '2♥', '2♦'), m(...fivePairs))).toBe(true);
    expect(beats(m('2♠', '2♥', '2♦'), m(...fourPairs))).toBe(false);
  });

  it('5.4 bombs beat only 2s', () => {
    expect(beats(m('9♦'), m('7♠', '7♥', '7♦', '7♣'))).toBe(false);
    expect(beats(m('2♠'), m('2♠', '2♥'))).toBe(false); // pair of 2s is not a chop
    expect(beats(m('2♠', '2♥', '2♦'), m('7♠', '7♥', '7♦', '7♣'))).toBe(false); // 4oak ≠ DS family
  });

  it('5.5 bombs answered only by higher bombs of the same family', () => {
    expect(beats(m('5♠', '5♥', '5♦', '5♣'), m('6♠', '6♥', '6♦', '6♣'))).toBe(true);
    expect(beats(m('5♠', '5♥', '5♦', '5♣'), m('4♠', '4♥', '4♦', '4♣'))).toBe(false);
    expect(beats(m('5♠', '5♥', '5♦', '5♣'), m('2♠', '2♥', '2♦', '2♣'))).toBe(true);
    expect(
      beats(m('5♠', '5♥', '5♦', '5♣'), m('3♠', '3♥', '4♠', '4♥', '5♠', '5♥', '6♠', '6♥')),
    ).toBe(false); // DS never answers 4oak

    // Double sequences: longer wins, then top card.
    expect(beats(m('3♠', '3♥', '4♠', '4♥', '5♠', '5♥'), m('6♠', '6♥', '7♠', '7♥', '8♠', '8♥'))).toBe(true);
    expect(
      beats(m('3♠', '3♥', '4♠', '4♥', '5♠', '5♥'), m('4♠', '4♥', '5♠', '5♥', '6♠', '6♥', '7♠', '7♥')),
    ).toBe(true); // longer beats shorter
    expect(
      beats(m('4♠', '4♥', '5♠', '5♥', '6♠', '6♥', '7♠', '7♥'), m('3♠', '3♥', '4♠', '4♥', '5♠', '5♥', '6♠', '6♥')),
    ).toBe(false);
    expect(beats(m('5♠', '5♥', '6♠', '6♥', '7♠', '7♥'), m('5♣', '5♦', '6♣', '6♦', '7♣', '7♦'))).toBe(false);
    expect(beats(m('5♣', '5♦', '6♣', '6♦', '7♣', '7♦'), m('5♠', '5♥', '6♠', '6♥', '7♠', '7♥'))).toBe(true);
  });

  it('5.6 four 2s is a normal four-of-a-kind and unbeatable', () => {
    const quad = m('2♠', '2♥', '2♦', '2♣');
    expect(quad.type).toBe('fourofakind');
    expect(beats(quad, m('A♠', 'A♥', 'A♦', 'A♣'))).toBe(false);
    expect(beats(quad, m('3♠', '3♥', '4♠', '4♥', '5♠', '5♥', '6♠', '6♥', '7♠', '7♥'))).toBe(false);
  });
});

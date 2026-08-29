import { describe, expect, it } from 'vitest';
import { cardLabel, cmpCard, DECK, THREE_SPADES } from '../src/index.js';
import { C, hand } from './helpers.js';

describe('rule 1 — cards and ordering', () => {
  it('1.1 deck has 52 unique cards, no jokers', () => {
    expect(DECK).toHaveLength(52);
    const keys = new Set(DECK.map((c) => c.rank * 4 + c.suit));
    expect(keys.size).toBe(52);
  });

  it('1.2 rank order: 3 < 4 < … < 10 < J < Q < K < A < 2', () => {
    const ranks = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'];
    for (let i = 1; i < ranks.length; i++) {
      expect(cmpCard(C(`${ranks[i]!}♠`), C(`${ranks[i - 1]!}♠`))).toBeGreaterThan(0);
    }
  });

  it('1.3 suit order: ♠ < ♣ < ♦ < ♥ for equal rank', () => {
    const suits = ['♠', '♣', '♦', '♥'];
    for (let i = 1; i < suits.length; i++) {
      expect(cmpCard(C(`A${suits[i]}`), C(`A${suits[i - 1]}`))).toBeGreaterThan(0);
    }
  });

  it('1.4 suits break ties only within a rank', () => {
    expect(cmpCard(C('5♥'), C('5♦'))).toBeGreaterThan(0); // 5♥ beats 5♦
    expect(cmpCard(C('4♥'), C('5♠'))).toBeLessThan(0); // any 5 beats any 4
    expect(cmpCard(C('3♥'), C('2♠'))).toBeLessThan(0); // any 2 beats any 3
  });

  it('1.5 the 2♥ is the strongest card', () => {
    for (const label of ['A♥', '2♠', '2♣', '2♦']) {
      expect(cmpCard(C('2♥'), C(label))).toBeGreaterThan(0);
    }
  });

  it('1.x the 3♠ is the lowest card in the deck', () => {
    expect(THREE_SPADES).toEqual({ rank: 3, suit: 0 });
    expect(cmpCard(C('3♣'), THREE_SPADES)).toBeGreaterThan(0);
  });

  it('hands sort ascending by rank then suit', () => {
    const sorted = hand('K♠', '3♥', '10♦', '3♣');
    expect(sorted.slice().sort(cmpCard).map(cardLabel)).toEqual([
      '3♣',
      '3♥',
      '10♦',
      'K♠',
    ]);
  });
});

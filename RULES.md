# Tiến Lên (Thirteen) — Rules (v1, locked)

Southern Vietnamese Tiến Lên, user-locked suit order. This document is the
executable spec: every numbered bullet is enforced by at least one test in
`packages/engine/test/`, named after the bullet. If the code and this file
disagree, one of them is wrong — fix it in code, or amend the spec deliberately.

## 1. Cards and ordering

- **1.1 Deck** — 52 cards, no jokers.
- **1.2 Rank order** (low → high): 3 4 5 6 7 8 9 10 J Q K A **2**. The 2 is the highest rank.
- **1.3 Suit order** (low → high): ♠ spades < ♣ clubs < ♦ diamonds < ♥ hearts.
- **1.4 Suit tie-break** — suits only compare between cards of equal rank: 5♥ beats 5♦, but any 5 beats any 4 regardless of suit.
- **1.5 Strongest card** — the 2♥ is the strongest single card in the game.

## 2. Deal and opening

- **2.1 Deal** — every hand deals 13 cards to each of the 4 players.
- **2.2 Opening lead** — in the first hand of a game, whoever holds the 3♠ leads the first trick.
- **2.3 Opening inclusion** — that very first play must contain the 3♠ card itself: a single 3♠, a pair/triple/four-of-a-kind containing it, or a sequence / double sequence that includes it. A 3♣-4-5 run does not satisfy it.
- **2.4 Later hands** — from the second hand on, the previous hand's winner leads with any combination (no 3♠ requirement).

## 3. Combinations

- **3.1 single** — one card.
- **3.2 pair** — two cards of the same rank.
- **3.3 triple** — three cards of the same rank.
- **3.4 four-of-a-kind** — four cards of the same rank.
- **3.5 sequence** — 3+ consecutive ranks, suits mixed freely, ranks 3–A only (**no 2s**). Q-K-A is legal; K-A-2 is not.
- **3.6 double sequence** — 3+ consecutive pairs, ranks 3–A only (no 2s); the two cards of each rank may be any suits.

## 4. Beating

- **4.1** A play only beats the current top play if it is the same combination type of the same size with a higher top card (top card compared by rank, then suit).
- **4.2** Nothing else beats anything: a triple never beats a pair, a 5-run never beats a 4-run, and non-bomb combinations never beat across types.
- **4.3** Any valid combination may be led, including bombs.

## 5. Bombs (chops)

- **5.1** A four-of-a-kind or a double sequence of 3+ pairs beats a single 2.
- **5.2** A double sequence of 4+ pairs beats a pair of 2s.
- **5.3** A double sequence of 5+ pairs beats a triple of 2s.
- **5.4** Bombs beat only 2s — never other singles/pairs/triples (rule 4.2 still applies to non-2 targets).
- **5.5** Once a bomb is on the table, only a higher bomb of the same family may answer it: four-of-a-kind by higher rank; double sequences by longer, then by top card.
- **5.6** Four 2s is a normal four-of-a-kind (no instant win in v1).

## 6. Passing

- **6.1** The trick leader may never pass.
- **6.2** Any other player may pass on their turn instead of playing.
- **6.3** Passing locks a player out until the trick ends: they cannot re-enter that trick, even with a bomb.

## 7. Trick resolution

- **7.1** A trick ends as soon as every other active player has passed; the last play wins.
- **7.2** The trick winner leads the next trick.
- **7.3** If the trick winner is out of cards, the lead passes to the next player clockwise who still has cards.

## 8. Hand end and scoring

- **8.1** The hand ends the instant the third player sheds their last card; the remaining player finishes 4th.
- **8.2** Placings score 1st = 3, 2nd = 2, 3rd = 1, 4th = 0 points, accumulated across hands.
- **8.3** No penalty or rank-up scoring in v1.

## 9. Game end

- **9.1** After each hand, if exactly one player holds the sole highest score and it is 10 or more, that player wins the game.
- **9.2** Otherwise, play another hand (winner leads, rule 2.4).

## 10. Explicitly out of scope in v1

Instant-win hands (dragon, six pairs, four 2s), Northern same-suit sequence rules,
penalty counting, jokers. These become engine config flags later — the engine must
not hardcode against them.

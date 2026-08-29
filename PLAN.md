# Thirteen (Tiến Lên) — Project Plan

Web app for Tiến Lên: one human vs 3 bots first, internet multiplayer later. Svelte frontend, TypeScript end-to-end.

## 0. The one architectural decision that matters

**The game engine is a pure, deterministic TypeScript package with zero I/O.** It knows cards, combinations, legal moves, turn order, bombs, and scoring — nothing about UI, network, or storage.

- v1 (vs bots): engine runs in the browser. Bots are just functions from game state → move. **No backend needed.**
- v2 (multiplayer): the same engine runs on the server as the authoritative validator. Client code doesn't change — it already speaks engine terms.

Everything below follows from this: build the engine first, keep transports swappable, and multiplayer becomes "add a server that replays actions through the engine" instead of a rewrite.

```
┌────────────────────────────────────────────────────┐
│ packages/engine (pure TS, no I/O)                  │
│  deck · combos · legalMoves · applyMove · scoring  │
├────────────────────────────────────────────────────┤
│ packages/bots (pure TS)                            │
│  heuristic bot: (GameState, seat) → Move           │
├───────────────────┬────────────────────────────────┤
│ apps/web (Svelte) │ apps/server (Node + ws)        │
│  v1: engine + bots│  v2: authoritative engine,     │
│  run in-browser   │      rooms, action log, DB     │
└───────────────────┴────────────────────────────────┘
```

Monorepo via pnpm workspaces:

```
thirteencardgame/
  packages/engine/     # rules. ~0 deps. Vitest.
  packages/bots/       # bot strategies. depends on engine types only.
  apps/web/            # SvelteKit app (v1 ships this alone)
  apps/server/         # Node game server (v2)
  PLAN.md  RULES.md
```

## 1. Rules we're implementing (locked for v1)

**Vietnamese (Southern) Tiến Lên — user-locked suit order: ♠ spades < ♣ clubs < ♦ diamonds < ♥ hearts, so hearts is the highest suit and the 2♥ is the strongest card in the game.** Full spec goes in `RULES.md` — the executable spec; every bullet becomes an engine test.

- **Deck/rank**: 52 cards, no jokers. Ranks 3 < 4 … 10 < J < Q < K < A < 2. Suit order ♠ < ♣ < ♦ < ♥ (hearts highest); suits break ties only between equal ranks — e.g. 5♥ beats 5♦, but any 5 beats any 4.
- **Deal**: 13 each. The holder of 3♠ leads the very first play of the *game* and must include it. From hand 2 on, previous hand's winner leads anything.
- **Combinations**: single, pair, triple, four-of-a-kind, sequence (3+ consecutive ranks, suits mixed, **no 2s**, Q-K-A ok, K-A-2 not), double sequence (3+ consecutive pairs, no 2s).
- **Beating**: same type + same size, higher top card (rank, then suit — hearts highest). Nothing else — a triple never beats a pair, a 5-run never beats a 4-run.
- **Bombs**: four-of-a-kind or double-sequence-3+ beats a single 2; double-sequence-4+ beats a pair of 2s; double-sequence-5+ beats triple 2s. Once a bomb is down, only a higher bomb of the same family can answer (4oak > 4oak by rank; double-seq: longer wins, then top card). Bombs may be led.
- **Passing**: pass locks you out until the trick clears. Leader can never pass. Trick clears when all others passed; last player leads (or next player with cards if they went out).
- **Hand end**: when the 3rd player sheds out. Game = hands until someone is sole leader at 10+ points, scoring 3/2/1/0 by place.
- **Not in v1**: instant-win hands (dragon, six pairs, four 2s), Northern same-suit sequence rules, penalty counting. All become engine config flags later, so don't hardcode against them.

## 2. Decisions (defaults — override any before we start)

| Area | Choice | Why |
|---|---|---|
| Framework | SvelteKit + Svelte 5 (runes) + TypeScript | requested; Svelte 5 runes map cleanly to a state-machine game |
| Styling | Tailwind CSS v4 | fast iteration on layout; cards styled with plain CSS/SVG inside components |
| Engine language | TypeScript, no framework deps | shared client/server, testable in Vitest without a browser |
| Tests | Vitest (engine/bots), Playwright (E2E from M2) | engine fuzzing is the main defense against rules bugs |
| DB (v2) | SQLite + Drizzle ORM, Postgres-compatible schema | boring, zero-ops start; swap driver later |
| Transport (v2) | WebSockets (`ws`) on a custom Node server | see §5 — SvelteKit's own server doesn't do WS cleanly |
| Hosting (v2) | single container (Fly.io / Railway) | one process serves HTTP + WS + DB; serverless WS is pain |
| Auth (v2) | anonymous guest cookie → named accounts → OAuth later | don't block multiplayer on identity |

## 3. UI plan

### 3.1 Routes (SvelteKit)

- `/` — home: "New game vs bots" (v1), later "Play online" + lobby link.
- `/play` — local game vs bots (v1). Client-only, no server round-trip.
- `/rules` — renders RULES.md (players will need it; it also validates the doc).
- v2 adds `/lobby` and `/game/[id]` — same table component, data over WS instead of local engine calls.

### 3.2 State model

One `GameState` (engine type) drives everything; UI is a pure function of it. Svelte 5 runes:

- `game = $state<GameState | null>(null)` — authoritative engine state.
- `view` derives per-seat: your hand sorted, opponents' counts, current trick, whose turn, legal moves for you right now (`legalMoves(game, YOU)`).
- Bot turns scheduled by a small driver (`setTimeout` 600–1200ms think-time) that calls `applyMove`.
- Play history kept as an action list → enables the last-trick display, a move log, and free replay later.

This is the same state shape the server will broadcast in v2, so the table UI gets reused verbatim.

### 3.3 Components

| Component | Responsibility |
|---|---|
| `Table` | layout: 3 seats + center pile + your hand. Handles seat positioning (bottom/you, left/top/right). |
| `Hand` | your 13 cards: click-to-select (cards raise), sort mode toggle (by rank / by straight groups), legal-move ghost highlighting when it's your turn |
| `Card` | rank + suit, SVG-ish CSS card face, aria-label ("Queen of Hearts"), `disabled` dimming |
| `Seat` | opponent avatar, name, card-back count, "passed" badge, thinking indicator |
| `TrickPile` | current play rendered as the combo it is (pair side by side, run fanned), bomb flash animation |
| `TurnBanner` | "Your turn — beat 9♦ or pass", subtext shows what's needed |
| `ActionBar` | Play / Pass buttons, disabled + reason when illegal ("select a higher pair") |
| `Scoreboard` | per-hand placings, running 3-2-1-0 totals, "Game over — you win" state |
| `LogDrawer` | collapsible move history (also our QA tool while testing bots) |

### 3.4 Interaction decisions

- **Click-to-select + buttons, not drag-and-drop**, for v1: reliable, mobile-friendly, unambiguous. Drag reordering within the hand can come later.
- Illegal selections are shown but the Play button explains *why* (state-machine → human sentence). Legal-move highlighting: cards that participate in at least one legal move get a subtle glow — this is the single biggest usability win for new players.
- Optional "auto-pass" toggle: if you have no legal move, pass immediately after a beat.
- Animations: Svelte `fly`/`scale` transitions for cards entering the pile, `flip` for dealing, `shake` on illegal attempt. `prefers-reduced-motion` respected. No canvas, no physics — CSS transforms only.
- Sound (later, tiny): card snap + your-turn chime, mute toggle.

### 3.5 Visual direction

Green felt table, crisp vector-ish cards (custom CSS/SVG, no card-font dependency), high contrast for rank/suit legibility at small sizes, dark-mode-friendly. Opponent hands as stacked card-backs. Mobile: seats compress to compact pill rows, hand becomes horizontally scrollable — verify at 375px early, not at the end.

**Card rendering** — no npm package; Svelte has no maintained card library and the JS ones (e.g. `deck-of-cards`) are jQuery-era. All cards flow through one `Card.svelte`: a CSS box (2.5:3.5 `aspect-ratio`, rounded corners, shadow) + corner indices (rank over suit) + **inline SVG suit paths** for the 4 glyphs (system-font suit characters vary per OS; 4 tiny SVG paths render identically everywhere, standard red/black coloring — hearts/diamonds red, hearts still just the highest *suit*) + simple center layout (big rank+suit; court cards as letter in v1). Card backs are a CSS pattern. If we later want classic pip arrangements / full court-card faces, drop in Byron Knoll's public-domain **Vector Playing Cards** SVGs behind the same component — a content swap inside `Card.svelte`, not a refactor.

### 3.6 UI milestones

- **U1** — static table with real cards rendering from a dealt engine state (no interaction).
- **U2** — full interaction loop: select → legal-move validation → play/pass → trick clears → next hand → scoring. Playable game.
- **U3** — polish pass: animations, auto-pass, log drawer, empty/edge states (you have 1 card left, opponents passed, bomb on table).
- **U4** — responsive + a11y pass: 375px→desktop, keyboard (Enter=play, P=pass), screen-reader labels.

## 4. Engine plan (`packages/engine`)

Pure functions over immutable-ish state; every mutation returns a new state. API sketch:

```ts
type Card = { rank: 3|4|…|15 /*2*/, suit: 0|1|2|3 }   // suit 3 = hearts (highest)
type Move = { type: 'single'|'pair'|'triple'|'fourofakind'|'sequence'|'doublesequence',
              cards: Card[] }
type GameState = {
  players: { hand: Card[]; out: boolean; passed: boolean }[4]
  trick: { plays: { seat: number; move: Move }[]; leader: number }
  leader: number;         // leads current trick
  handNumber: number;     // 3♠ opening applies iff handNumber === 0
  scores: [number, number, number, number];
  winner?: …
}
legalMoves(state, seat): Move[]      // the workhorse — drives UI highlighting AND server validation
applyMove(state, seat, move): GameState
```

Correctness details that must be test-enforced: bomb tier matrix; pass-locks-you-out per trick; leader-cannot-pass; 3♠ must be *included* (single 3♠, pair 33 containing ♠, or a run 3-4-5 all satisfy it); trick winner = last play; leading after going out skips to next player with cards; sequence top-card comparison by rank-then-suit with hearts highest; 2 excluded from all sequences.

Verification: exhaustive unit tests per rule (from RULES.md) + a **fuzzer**: random legal games played to completion by random legal moves × 10k seeds, asserting invariants (hand sizes always sum right, game always terminates, exactly 3 players go out). This catches 95% of rules bugs before any UI exists.

## 5. Backend architecture (staged)

### Stage A — v1: no backend

Everything in-browser. Deploy the SvelteKit app as a static/adapter-node site. This gets a playable product in weeks, not months, and de-risks the rules engine. **The backend work starts only after the local game is fun.**

### Stage B — v2: authoritative game server (the multiplayer milestone)

**Why not SvelteKit's server for WS:** SvelteKit's adapter-node/dev server doesn't handle WebSocket upgrades natively (no built-in `upgrade` hook; Vite dev WS is HMR-only). Standard boring solution:

- `apps/server`: small Node HTTP server (`ws` library) — owns game rooms.
- In production, one container: server imports SvelteKit's built handler (`adapter-node` export) as HTTP middleware and handles `/ws` upgrades itself on the same port. In dev, Vite proxies `/ws` → server port. One origin, no CORS, no sticky-session weirdness.

**Protocol (JSON over WS, one message type envelope):**

```jsonc
// client → server
{ "t": "join",  "room": "ABC123" }
{ "t": "action", "seq": 7, "move": { ... } }   // seq = client's action counter (idempotency)
{ "t": "leave" }
// server → client
{ "t": "state", "seq": 8, "state": { ...view-for-this-seat... } }  // full snapshot, simple + robust
{ "t": "event", "name": "played", "seat": 1, "move": {...} }        // for animations
{ "t": "error", "on": 7, "code": "not_your_turn" }
```

Server design:

- **Authoritative**: server runs the *same engine*; client moves are validated via `legalMoves` before `applyMove`. Client-side engine use becomes convenience/preview only.
- **Per-seat state filtering**: clients receive their own hand in full; opponents as counts only. No trusting the client, no leaking hands.
- **Rooms**: create → 4-char code; seats fill; host can start with bots filling empty seats (this is how "play with friends + bots" works for free). Room = in-memory state machine; games are short.
- **Reconnect**: server keeps the action log per game; on reconnect, client sends `join` and receives fresh `state` snapshot + recent events. Cookie/session id survives reloads. Heartbeat/ping every 15s; disconnect grace 60s before bot takes over the seat.
- **Bot filling** reuses `packages/bots` server-side — identical to v1 behavior.

### Stage C — v3: persistence & accounts

- **DB (SQLite via Drizzle)** — schema is event-sourced-friendly:

  ```sql
  users        (id, guest_key, display_name, created_at)
  games        (id, room_code, state, started_at, ended_at, winner)
  game_players (game_id, seat, user_id, bot_level, final_place)
  game_actions (game_id, seq, seat, move_json, at)   -- replayable log
  user_stats   (user_id, games, wins, avg_place, updated_at)
  ```

  `game_actions` gives replay, anti-cheat audits, and free "watch the replay" later. Stats update transactionally on hand end.
- **Auth**: guest cookie first (zero friction), then claim-your-guest (set display name + password), OAuth last.
- **Deployment**: still one container; SQLite file on a mounted volume. Postgres swap only when there's a reason (multi-node, backups) — schema is already portable.

### Stage D — later/optional

Matchmaking queue, spectator mode, ELO, instant-win rule toggles, Cloudflare Durable Objects if we ever want edge rooms. None of these change Stage B contracts.

## 6. Bots (`packages/bots`)

Pluggable: `type Bot = (state: GameState, seat: number) => Move`. Levels:

- **L0 Random**: any legal move. Exists for fuzzing and as a floor.
- **L1 Greedy (v1 default)**: shed lowest legal cards; lead combos that use the most cards; save bombs/2s unless it wins the trick or hand; hold sequences intact. ~50 lines of heuristics, surprisingly fun to play against.
- **L2 Tracking (later)**: counts played cards, tracks remaining 2s/bombs, decides when to dump a 2 before an opponent's last cards, targets the runner-up seat. Iterate via the fuzzer: bots play 10k games, rank win rates.

## 7. Testing strategy

1. **Engine unit tests** — one per RULES.md bullet, named after it (`bombs: 4oak beats single 2`).
2. **Engine fuzzer** — random games terminate with valid scoring (CI, every commit).
3. **Bot tournament** — L1 vs L0 × 1000 games → sane win-rate distribution (catches bot + engine regressions).
4. **UI E2E (Playwright)** — one happy-path script: deal → play hands → game over screen; and one rule path (bomb beats 2) driven through the real UI.
5. **Server integration (v2)** — spin server + 4 WS clients (2 human, 2 bot), play full game, assert state convergence and reconnect snapshot equality.

## 8. Milestones

| # | Deliverable | Acceptance |
|---|---|---|
| **M0** | Monorepo scaffold + RULES.md locked | `pnpm dev` runs empty app; CI green |
| **M1** | Engine complete | 100% rule bullets tested; fuzzer 10k games clean |
| **M2** | Playable vs bots (UI U2 + bot L1) | full game end-to-end in browser; E2E passes |
| **M3** | Polish (U3+U4): animations, responsive, a11y, log | looks/works at 375px; keyboard-playable |
| **M4** | Game server + rooms + reconnect (Stage B) | 2 humans + 2 bots online game; reload mid-game resumes |
| **M5** | Persistence + guest accounts + stats (Stage C) | history + stats visible; survives deploy |
| **M6** | L2 bot, lobby, polish backlog | — |

M0→M2 is the whole v1 product. M4+ starts only after M2 is fun to play.

## 9. Risks

- **Rules edge cases** (bomb tiers, 3♠-in-combo, pass semantics, suit tie-breaks) → RULES.md-as-tests + fuzzer, before UI.
- **Scope creep toward multiplayer** → engine purity is the firewall; no server code exists until M4.
- **WS + SvelteKit friction** → known pattern (custom server reusing built handler), proven, no exotic deps.
- **Card UI time sink** (perfect drag physics etc.) → click-to-select v1; polish is a separate milestone, not a blocker.

# Thirteen — Visual Modernization Spec (V1)

Implementation brief for the visual/UX layer of `apps/web`. Engine, bots, protocol,
drivers, and server are **out of scope and must not change**. Every number in this
document was measured in the running app or computed against the stated formula —
do not substitute taste for the locked values in §3 and §4.

Target: the game should read as *a card table*, not a form with card-shaped buttons.

---

## 0. Inviolable contracts

These are load-bearing for the E2E suite and the two drivers. Breaking any one is a
failed implementation, regardless of how the result looks.

**DOM hooks that MUST survive verbatim** (grep-verified consumers in `apps/web/e2e/`):

| Hook | Consumer | Notes |
|---|---|---|
| `.play-card` (class on the card button) | `online.spec.ts` counts hand size | must be exactly one per hand card |
| `[data-hand]` | `play.spec.ts`, `bomb.spec.ts` | wrapper of the human hand |
| `[data-card="<rank*4+suit>"]` | `play.spec.ts`, `bomb.spec.ts` | on each `.play-card`, clickable |
| `[data-seat="<name>"]` | `online.spec.ts`, deal-target measurement in `GameTable.svelte` | exactly 3 (opponents only) |
| `data-testid`: `deal-button`, `deal-panel`, `play-button`, `pass-button`, `play-reason`, `next-hand`, `scoreboard`, `game-over`, `game-over-panel`, `turn-banner`, `trick-pile`, `last-trick`, `trick-play-<i>`, `log-drawer` (+ a `summary` child that toggles it), `connect-panel`, `room-panel`, `name-input`, `create-room`, `create-password-input`, `join-button`, `join-password-input`, `room-code`, `room-code-input`, `share-link`, `share-copy`, `start-button`, `waiting-text`, `connect-error` | all three specs | may move in the tree; may not disappear or duplicate |
| `window.__thirteen` dev hook in `game.svelte.ts` | all specs | untouched |

**Text assertions that MUST still be present in the DOM** (`bomb.spec.ts`):
`trick-pile` contains `describeMove(...)` of the winning play *and* the compact
label of beaten cards (`2♠`); `last-trick` contains `"<name> won with <move>"`;
`turn-banner` contains `"lead any combination"` when you lead a fresh trick;
`log-drawer` contains move descriptions after its `summary` is clicked.

**Behavioral contracts:** `Enter` = play, `p`/`P` = pass (`GameTable.onKeydown`);
`prefers-reduced-motion` neutralizes animation; `?fast=1` keeps deal pacing at
`DEAL_INTERVAL_FAST_MS`; the deal animation's `--dx/--dy` target measurement in
`GameTable.svelte` must keep working against the new dock/seat geometry.

**Non-goals:** sound, avatars sourced from network, drag-and-drop reordering,
canvas/WebGL, any new runtime dependency, light theme, engine-visible changes.

---

## 1. What is wrong today (measured, at `1440×900` and `844×390`)

| # | Defect | Evidence |
|---|---|---|
| 1.1 | **No table exists.** The "felt" is `bg-emerald-950/40` on a `bg-emerald-950` body — contrast **1.15:1**. The play area is a 533×256 rounded rectangle floating in an identically-colored void. | measured `getComputedStyle` + screenshot |
| 1.2 | **43% of the viewport is dead space.** Content bottom `744px` in a `900px` viewport; the table is a `flex-col` stack, not a bounded surface. | `contentBottom: 744` |
| 1.3 | **The trick is a text list, not cards.** Plays render as left-aligned rows of 34×47px `.mini-card` text labels with `opacity-40 grayscale` on beaten plays — reads as disabled/broken UI, not as cards on a table. | `TrickPile.svelte:67-100` |
| 1.4 | **Seats are disconnected pills.** No spatial relationship to the play area; N/W/E pods sit 200px+ from the felt with no seating ring. | `seatTop` box vs `trickPile` box |
| 1.5 | **The hand is a row of flat rectangles**, `gap-1`, no fan, no overlap. At `844×390` it **wraps to two rows** (`hand.h = 206` = 2 × 95 + gap), destroying the "one hand" read. | measured |
| 1.6 | **Mobile landscape is unplayable.** Document scrolls (`scrollHeight 863` vs `vh 390`); the trick pile is clipped **above the fold** (`pile.y = -83`). | measured |
| 1.7 | **Portrait is refused**, not designed — `.rotate-overlay` blocks all phone-portrait play. A two-row dock fits from **320px** wide (§4.4), so the block is unnecessary. | computed |
| 1.8 | **Duplicate "Game over"** — `Scoreboard` and `game-over-panel` both render it. | `innerText.match(/Game over/g).length === 2` |
| 1.9 | **Sub-44px touch targets.** Header "New game" is **30px** tall. | measured `tapTargets` |
| 1.10 | **Card face is weakest at the size it's most used.** Red pips are `text-red-600` = **4.77:1** on white; corner index is 12px; in any overlapped fan only the left strip is visible and it carries no reliable identity. | measured |
| 1.11 | **Card backs will vanish on a real felt** — current `#1e3a5f` against the new felt is 1.16:1. | computed |
| 1.12 | **No visual hierarchy or type system.** System UI stack only, no display face, no tabular numerals for scores, 40 ad-hoc Tailwind color utilities across 12 components, zero design tokens. | `grep` utility census |

---

## 2. Direction

**Modern tactile card lounge.** One bounded, lit felt surface; four seats around it;
cards are physical objects that fly, land, overlap, and get swept. Dark, low-chroma
chrome so the felt and the white card faces are the only bright things on screen —
attention goes to cards, always.

Three rules that resolve every ambiguity below:

1. **The felt is the brightest large surface; cards are brighter still; chrome recedes.**
2. **Every card is identifiable from its exposed left strip alone** (fans overlap ~40–60%).
3. **The play surface never scrolls.** It is a `100dvh` grid; overflow is a design bug.

---

## 3. Tokens

Declare once in `apps/web/src/app.css` inside `@theme` (Tailwind v4 native token
mechanism — generates `bg-felt`, `text-ink-muted`, etc.; no config file needed).
Ratios below are **measured in-browser** (canvas sRGB sample → WCAG relative
luminance), not estimated.

### 3.1 Color

```css
@theme {
  /* chrome */
  --color-bg:             oklch(0.170 0.022 168);  /* #06120e */
  --color-surface:        oklch(0.235 0.028 168);  /* #10221c */
  --color-surface-raised: oklch(0.285 0.032 168);  /* #192f27 */
  --color-hairline:       oklch(0.345 0.030 168);

  /* table */
  --color-felt:      oklch(0.375 0.085 158);  /* #054e2f */
  --color-felt-deep: oklch(0.315 0.075 158);  /* #003d22 — center wash / vignette */
  --color-felt-rim:  oklch(0.245 0.055 160);  /* #002817 — table edge */

  /* text */
  --color-ink:        oklch(0.975 0.008 160);  /* #f2f8f5 */
  --color-ink-muted:  oklch(0.845 0.045 165);  /* #b2d6c5 */
  --color-ink-subtle: oklch(0.715 0.038 165);  /* #8eab9d — chrome only, NEVER on felt */

  /* semantic */
  --color-accent:     oklch(0.800 0.150 164);  /* #44dba4 — legal / primary action */
  --color-accent-ink: oklch(0.205 0.040 168);  /* #011d14 — label on accent */
  --color-gold:       oklch(0.855 0.145 88);   /* #f7c950 — turn, winner, selection */
  --color-danger:     oklch(0.735 0.175 22);   /* #ff7576 — chrome only, NEVER on felt */
  --color-focus:      oklch(0.830 0.120 230);  /* #6ad6ff — focus ring, non-semantic hue */

  /* cards */
  --color-card-face:  oklch(0.985 0.005 95);   /* #fbfaf6 warm white */
  --color-card-red:   oklch(0.505 0.205 26);   /* #be0119 */
  --color-card-black: oklch(0.245 0.020 250);  /* #19212a */
  --color-card-back:  oklch(0.600 0.085 262);  /* #6480b3 */
  --color-card-back-ink: oklch(0.760 0.060 262);
}
```

**Verified contrast matrix** (all text pairings ≥ 4.5:1):

| pair | ratio | | pair | ratio |
|---|---|---|---|---|
| ink / bg | 17.74 | | ink / felt | 9.13 |
| ink-muted / bg | 12.10 | | ink-muted / felt | 6.23 |
| ink-subtle / bg | 7.69 | | ink-subtle / felt | **3.96 ✗** |
| ink / surface | 15.40 | | accent / felt | 5.57 |
| ink-muted / surface | 10.51 | | gold / felt | 6.28 |
| ink-subtle / surface | 6.68 | | focus / felt | 5.93 |
| accent / bg | 10.83 | | danger / felt | **3.77 ✗** |
| accent-ink / accent | 10.04 | | card-red / card-face | 6.27 |
| gold / bg | 12.20 | | card-black / card-face | 15.56 |
| danger / surface | 6.36 | | card-face / felt | 9.41 |
| felt / bg | 1.94 (surface separation) | | card-back / felt | 2.47 |

**Two hard rules from the matrix:** `ink-subtle` and `danger` are **chrome-only**.
On felt use `ink-muted` (6.23:1) for secondary text and `gold` (6.28:1) for warnings.

### 3.2 Type

Add exactly one webfont, self-hosted, subset latin + `latin-ext` (Vietnamese
diacritics are required — "Tiến Lên", bot names `Hùng`, `Tuấn`). Place under
`apps/web/static/fonts/`, `font-display: swap`, preload the display weight only.

```css
@theme {
  --font-display: 'Outfit Variable', ui-sans-serif, system-ui, sans-serif; /* 500–700 */
  --font-sans: ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  --font-card: var(--font-display);
}
```

- Display face: headings, rank glyphs, score numerals, room codes, buttons.
- Body face: prose, rules page, log entries (keep the system stack — zero cost).
- **All numerals in the rail/scoreboard/room code use `font-variant-numeric: tabular-nums`** so scores don't jitter as they tick.
- Scale (rem): `0.6875 / 0.75 / 0.8125 / 0.875 / 1 / 1.25 / 1.75 / 2.5 / 3.5`.

### 3.3 Elevation, radius, motion

```css
@theme {
  --radius-card: 8%;                 /* percentage of card width — scales with card */
  --radius-pod: 0.875rem;
  --radius-panel: 1.25rem;

  --shadow-card:      0 1px 2px oklch(0 0 0 / 0.30), 0 4px 10px oklch(0 0 0 / 0.28);
  --shadow-card-lift: 0 2px 4px oklch(0 0 0 / 0.32), 0 12px 26px oklch(0 0 0 / 0.42);
  --shadow-felt:      inset 0 1px 0 oklch(1 0 0 / 0.06), 0 32px 70px oklch(0 0 0 / 0.55);
  --shadow-pod:       0 2px 8px oklch(0 0 0 / 0.35);

  --ease-card: cubic-bezier(0.22, 1, 0.36, 1);   /* out-quint: lands, doesn't bounce */
  --ease-snap: cubic-bezier(0.34, 1.4, 0.64, 1); /* selection only */
  --dur-fast: 120ms; --dur-base: 200ms; --dur-slow: 340ms; --dur-sweep: 520ms;
}
```

Focus ring, applied globally to every interactive element (there is currently none):
`outline: 2px solid var(--color-focus); outline-offset: 2px;` on `:focus-visible`.

---

## 4. Layout

### 4.1 Shell — `/play` and `/online` (in-game)

Replace the `max-w-5xl` scrolling `<main>` with a non-scrolling three-row grid.

```
height: 100dvh; display: grid; overflow: hidden;
grid-template-rows: auto minmax(0, 1fr) auto;   /* Rail | Table | Dock */
grid-template-areas: "rail" "table" "dock";
```

- Body gets `overscroll-behavior: none` and the shell `overflow: hidden`. Only the
  log panel and the rules page scroll internally.
- `padding-inline: max(0.75rem, env(safe-area-inset-left))`, and
  `padding-bottom: env(safe-area-inset-bottom)` on the dock (iPhone home bar).
- The rules page and the online connect/lobby screens keep normal document flow.

### 4.2 Rail (row 1, `44–52px`)

One component, `Rail.svelte`, replaces both the `<header>` in `routes/play/+page.svelte`
and the chrome of `Scoreboard.svelte`.

`[brand ♠ Thirteen] [hand pill] ——— [4 score chips] ——— [icon: log] [icon: new game] [nav]`

- Score chips: `data-testid="scoreboard"`, still containing `"<name>: <score>"` for
  `play.spec.ts`. Layout: name (11px, `ink-subtle`) over score (17px, display, tabular).
  Active-turn chip gets a `gold` 2px left border; finished seats get an `accent` dot.
- Icon buttons: 44×44 hit area minimum (fixes 1.9), 20px glyph, `aria-label` required.
- On viewport height < 420px the rail collapses to 40px and hides the brand wordmark.
- `phase === 'handOver' | 'gameOver'` moves the `next-hand` / new-game button into the
  rail's right cluster (keep the test ids).

### 4.3 Table (row 2) — the felt

```
.table { container-type: size; position: relative; display: grid; place-items: center; }
.felt  { position: absolute; inset: 2.5% 3%; border-radius: 44% / 52%;
         background:
           radial-gradient(120% 90% at 50% 42%, var(--color-felt) 0%, var(--color-felt-deep) 72%),
           repeating-conic-gradient(from 0deg, oklch(1 0 0/0.010) 0deg 0.6deg, transparent 0.6deg 1.2deg);
         box-shadow: var(--shadow-felt), 0 0 0 clamp(6px, 1.1cqw, 14px) var(--color-felt-rim);
         /* rim = the table edge; do NOT use a 1px border */ }
```

- A `::after` layer carries a **static SVG noise/weave texture** (inline data URI,
  ≤1.2 KB, `opacity: 0.05`, `mix-blend-mode: overlay`) for felt tooth. No raster asset.
- Seat pods are absolutely positioned on the felt's rim, not stacked in flex rows:
  `top: { left: 50% / -50% translate, ... }` — concretely
  N = `top: 1.5%; left: 50%`, W = `left: 1.5%; top: 50%`, E = `right: 1.5%; top: 50%`,
  each `translate(-50%,-50%)`-anchored. Below `520px` container width, W/E move to
  `top: 22%` so they never collide with the center play zone.
- Center **play zone**: a `min(62cqw, 48cqh)` square, `place-items: center`. Trick cards
  are placed here, offset toward the playing seat's direction by `18%` of the zone
  (N: `translateY(-18%)`, W: `translateX(-18%)`, etc.) so a play visibly comes *from*
  a seat. This is what makes the trick legible without name labels doing all the work.

### 4.4 Dock (row 3) — your hand

Card geometry is **computed**, not hand-tuned. Publish these as CSS custom properties
on the shell and let every card size derive from them:

```css
--card-h: clamp(66px, 15.5dvh, 118px);         /* landscape */
--card-w: calc(var(--card-h) / 1.4);           /* locked 2.5:3.5 */
--fan-strip: clamp(26px, calc((100dvw - 3rem - var(--card-w)) / 12), calc(var(--card-w) * 0.62));
```

Verified against the model `fan = w + 12·strip`, `felt = vh − rail − dock`:

| viewport | cardH | cardW | strip | fan(13) | fits | feltH |
|---|---|---|---|---|---|---|
| 844×390 (phone landscape) | 66 | 47 | 29 | 398 | ✓ | 252 |
| 882×344 (iPhone landscape, min) | 66 | 47 | 29 | 398 | ✓ | 206 |
| 1024×600 | 93 | 66 | 41 | 561 | ✓ | 435 |
| 1280×720 | 112 | 80 | 49 | 673 | ✓ | 536 |
| 1440×900 | 118 | 84 | 52 | 711 | ✓ | 710 |
| 2560×1440 | 118 | 84 | 52 | 711 | ✓ | 1250 |

**The fan.** Cards overlap by `card-w − strip` and sit on a shallow arc:
card `i` of `n` gets `rotate((i − (n−1)/2) · 1.5deg)` and
`translateY(abs(i − (n−1)/2)² · 0.9px)`. Hover/selected cards get `z-index` above
their neighbors and lift; the arc must not clip — the dock reserves
`card-h + 26px` so a `−18px` selected lift never overflows.

**Portrait (delete `.rotate-overlay` entirely — defect 1.7).** Two rows, 7 + 6:

```css
@media (orientation: portrait) {
  --card-w: clamp(40px, min(calc((100dvw - 2rem) / 4.6), calc((100dvh - 262px) / 2.8)), 76px);
  --card-h: calc(var(--card-w) * 1.4);
  --fan-strip: calc(var(--card-w) * 0.60);
}
```

Verified (`fan(7) = w + 6·0.6w`, dock = 2 rows + 8px gutter + 28px padding):

| viewport | cardW | cardH | fan(7) | fits | dockH | feltH |
|---|---|---|---|---|---|---|
| 320×568 | 63 | 88 | 288 | ✓ | 211 | 313 |
| 390×844 | 76 | 106 | 350 | ✓ | 249 | 551 |
| 430×932 | 76 | 106 | 350 | ✓ | 249 | 639 |
| 768×1024 | 76 | 106 | 350 | ✓ | 249 | 731 |

In portrait the felt switches to a taller ellipse (`border-radius: 46% / 40%`) and
W/E pods move to `top: 18%`.

Dock stacking order, bottom-up: hand fan → action cluster → prompt line. The action
cluster is **pinned right of the fan on wide viewports** (`≥900px`) and **above the
fan on narrow ones** so the thumb path is short and the fan is never occluded.

---

## 5. Components

Existing file → what changes. Keep every file's props/driver interface identical
unless stated; this is a visual pass, not a refactor of `GameDriver`.

### 5.1 `Card.svelte` — the highest-leverage change

Anatomy (fixes 1.10):

- **Strip band.** The leftmost `--fan-strip` of the card is the only guaranteed-visible
  region. It must carry a full-height vertical identity: rank glyph (display face,
  `0.42 × card-w`, `line-height: 1`) with the suit pip directly beneath
  (`0.30 × card-w`). Both left-aligned in the band, top-anchored. This replaces the
  current 12px corner index.
- **Suit wash.** A `4%`-opacity radial tint of the suit color at the card's top-left
  plus a `2px` suit-colored bar along the card's left edge → red/black readable at a
  glance even when the glyph is small.
- **Center.** Large rank (`0.52 × card-w`) with suit pip beneath (`0.34 × card-w`),
  optically centered (`translateY(-4%)`). At `--card-w < 54px` hide the center block
  and let the strip band carry identity alone (replaces the `play-card-sm` hack).
- **Face.** `background: linear-gradient(158deg, var(--color-card-face), oklch(0.955 0.006 95))`,
  `border-radius: var(--radius-card)`, `box-shadow: var(--shadow-card)`,
  plus an inner hairline `inset 0 0 0 1px oklch(0.245 0.02 250 / 0.10)`.
- Keep the four inline 24×24 SVG suit paths exactly as they are (OS-independent glyphs).

States (all applied on `.play-card`, class names free to change **except `.play-card` itself**):

| state | treatment |
|---|---|
| default | `--shadow-card` |
| hover (enabled) | `translateY(-6px)`, `--shadow-card-lift`, `120ms` |
| **legal / highlighted** | `2px` inset `accent` ring + `0 0 14px accent/35%` glow, and `translateY(-3px)` — currently glow-only, which is easy to miss |
| **selected** | `translateY(-18px)`, `2px gold` ring, `--shadow-card-lift`, `gold/12%` face wash, `--ease-snap` |
| disabled | `opacity: 0.5`, `filter: saturate(0.6)`, no transform |
| played (on felt) | non-interactive `<div>`, no hover, `--shadow-card-lift` |
| beaten (on felt) | `scale(0.92)`, `opacity: 0.62`, `filter: brightness(0.82)` — **drop `grayscale`** (1.3) |

Add a `size` variant set: `'fan' | 'table' | 'mini'` replacing `'sm' | 'md'`, all
driven by `--card-w`. `mini` is text-label-only and is used **only** in the log.

Accessibility: keep `aria-label={cardName(card)}` + `aria-pressed`. Add
`aria-describedby` pointing at a hidden legality note when highlighted.

### 5.2 `CardBack.svelte` — new file

Replaces the `.card-back` CSS class in `app.css` (used by `Seat` and the deal
animation). `--color-card-back` (`#6480b3`, 2.47:1 on felt — fixes 1.11), a woven
diagonal lattice from two `repeating-linear-gradient`s at ±45°, a `1.5px`
`card-face/70%` inset border as the classic white margin, and a centered ♠ medallion
at `opacity: 0.22`. Same `aspect-ratio: 2.5/3.5` and `--radius-card` as the face, so
face and back are the same physical object.

### 5.3 `TrickPile.svelte` → real cards on felt (fixes 1.3)

Stop rendering a text list. Render each play as an overlapped group of **real `Card`
components at `size="table"`**, positioned in the center play zone, offset toward the
playing seat (§4.3), rotated `(seat − 1) · 4deg + (index · 1.5deg)` for a hand-dealt look.

- Winning group: full opacity, `z-index: 30`, `2px gold` ring around the *group*, and a
  `gold`, `11px`, uppercase-tracked `describeMove(...)` caption beneath it —
  **this caption satisfies the `bomb.spec.ts` `trick-pile` text assertion.**
- Beaten groups: the "beaten" treatment from §5.1, `z-index` by recency, fanned out
  behind the winner so their strips remain visible — **the beaten `2♠` must stay in
  the DOM and visible** (`bomb.spec.ts`).
- A pass renders as a small `gold/70%` "PASS" chip on the felt at that seat's offset,
  not as a table row.
- Empty trick: centered `ink-muted` line `"<name> leads"`, plus the **last-trick
  recap** as a compact stack of 3 `mini`-size faces with the existing
  `"<name> won with <move>"` sentence (`data-testid="last-trick"` — asserted).
- Keep `data-testid="trick-pile"` on the play zone and `trick-play-<i>` per group.

### 5.4 `Seat.svelte` → seat pod

`[avatar] [name / card count] [status]`, `--radius-pod`, `bg: surface/70%` +
`backdrop-filter: blur(8px)`, `--shadow-pod`.

- **Avatar:** 32px circle, deterministic from the seat name (hash → hue), initial in
  display face. No network assets.
- **Card-back stack:** `min(cardCount, 13)` `CardBack`s at `0.34 × back-w` exposure,
  scaled to `0.42 × --card-w`. Count badge with tabular numerals.
- **Turn state:** `gold` 1.5px border + a pulsing `gold/28%` outer ring
  (`2s ease-in-out infinite`, reduced-motion → static ring) + `"Thinking…"`.
  This is currently a static box-shadow and reads as inert.
- **Passed:** `gold/70%` "PASSED" chip, pod desaturated to `0.75`.
- **Out:** `opacity: 0.45`, card stack replaced by an `accent` check + placing.
- Keep `data-seat={name}` on the pod root — the deal animation measures it.

### 5.5 `ActionBar.svelte` → action cluster

- **Play**: `bg-accent`, `text-accent-ink` (10.04:1), 48px tall, min 112px wide,
  display face, `--radius-pod`. Disabled: `surface-raised` + `ink-subtle`, never a
  faded accent (a faded primary reads as broken).
- **Pass**: outlined, `hairline` border, 48px, same width.
- Both show their key hint (`↵`, `P`) as an inline `ink-subtle` kbd chip — the
  shortcuts already exist and are currently undiscoverable.
- **Rejection reason**: `gold` on felt (never `danger` — 3.77:1), 13px, in a
  `felt-deep/70%` pill above the buttons; keep `data-testid="play-reason"` and the
  `{#key shakeKey}` remount + `.shake` class.
- **Auto-pass**: a real 36px toggle switch, not a bare checkbox.
- Selection summary: when ≥1 card is selected, show the classified combo name
  (`describeMove(selectedMove)`) or "not a combination" — instant feedback before Play.

### 5.6 `TurnBanner.svelte` → prompt line

Not a boxed banner; a single centered line in the dock, above the fan.
Your turn: `gold` bullet + `ink` text at 15px/600. Others: `ink-muted` at 14px with
a 3-dot progress animation. Same strings, same `data-testid="turn-banner"`, same
`role="status"` (screen readers already depend on it).

### 5.7 `LogDrawer.svelte` → slide-over panel

`<details>` → a rail icon button that opens a right-side panel (fixed, 320px,
`surface`, `backdrop-filter`, slide `--dur-base`). Keep `data-testid="log-drawer"`
**and a `summary`-role trigger element inside it** (`bomb.spec.ts` clicks
`log-drawer >> summary`) — simplest compliant approach: keep the `<details>/<summary>`
element as the trigger and style the `<details>` content as the panel.
Entries: hand pill, seat color dot, `mini` card faces inline, `describeMove` text.
Newest first (already). `overflow-y: auto` — the only scrolling region in-game.

### 5.8 `Scoreboard.svelte` → absorbed by `Rail.svelte`

Delete the standalone bar. `data-testid="scoreboard"` and `data-testid="game-over"`
move into the rail. **Remove the duplicate game-over text (1.8):** the rail shows a
compact `"<winner> wins"` + New game; the `game-over-panel` becomes the single
celebratory surface — a centered overlay on the felt with final placings 1–4,
per-seat scores (tabular), and the primary New game action. Keep both test ids,
but only the panel carries the long-form copy.

### 5.9 New: `DealOverlay` behavior in `GameTable.svelte`

Keep the existing measured `--dx/--dy` mechanism; upgrade the visuals only:
`CardBack` instead of `.card-back`, an arc via a mid-flight `rotate`, `--ease-card`,
`opacity` fade-in over the first 20%, and a `scale(0.9 → 1)` landing. The
"Dealing… n/52" counter becomes a centered `ink-muted` label with a thin progress
arc. **Re-verify the measurement code against the new dock**: seat-0 targets are
computed from `handAreaEl`'s box divided into 13 slots — with a fanned hand the slot
width must become `--fan-strip`, not `hr.width / 13`.

### 5.10 Landing `/`, `/online`, `/rules`

- **`/`**: full-bleed felt vignette background, a fanned 5-card hero (real `Card`
  components, `rotate(-14deg…14deg)`, staggered `--dur-slow` entrance), display-face
  wordmark at `3.5rem`, Vietnamese subtitle in `ink-muted`, two 52px CTAs
  (`New game vs bots` accent, `Play online` outlined), `Rules` as a tertiary text link.
- **`/online`**: connect/lobby panels become `surface` cards with `--radius-panel`,
  `--shadow-pod`, 48px inputs with `hairline` borders and `focus` ring, labels at
  13px `ink-muted`. Room code at `2.5rem` display, `letter-spacing: 0.3em`, tabular.
  Lobby seat list becomes 4 seat rows with the §5.4 avatars, "you" marked with an
  `accent` dot, empty seats shown as dashed placeholders reading "Bot will fill".
  Keep every `data-testid` in §0.
- **`/rules`**: keep `.rules` prose classes, retarget to the tokens; `h2` becomes
  `accent`; `code` gets `surface-raised`; add `max-width: 62ch` and a sticky
  section-nav on `≥1024px`. Suit glyphs in prose get their card color.

---

## 6. Motion

All CSS transform/opacity only. Every animation must be neutralized by the existing
`prefers-reduced-motion` block in `app.css` (keep it, and extend it to disable the
turn pulse and sweep rather than merely shortening them).

| Event | Animation | Duration |
|---|---|---|
| deal | arc from felt center to target, fade + `scale(0.9→1)` | `--dur-slow`, staggered by `DEAL_INTERVAL_MS` |
| select card | lift 18px + gold ring | `--dur-fast`, `--ease-snap` |
| you play | FLIP from the fan slot to the felt play zone | `--dur-base`, `--ease-card` |
| opponent plays | fade + `translate` from that seat's pod toward center | `--dur-base` |
| trick won | winning group slides toward the winner's pod, scales to `0.7`, fades | `--dur-sweep` |
| bomb played | one `gold` radial flash pulse behind the play zone, no shake | `--dur-slow` |
| illegal play | existing `.shake` on the reason pill (unchanged) | 350ms |
| your turn | 2s pulsing ring on your dock edge + the gold prompt bullet | loop |
| hand/game over | overlay fades in, placings stagger 60ms | `--dur-base` |

FLIP guidance: measure the source card rect on `onPlay` **before** the store commits,
then animate the felt-side card from that rect. If the play originates from a driver
event (opponent), use the seat pod rect as the source. Never animate `width`/`height`/
`top`/`left` — transforms only.

---

## 7. Accessibility & input

- Every interactive element ≥ 44×44 CSS px hit area (fixes 1.9); cards may be
  visually narrower than 44px but must carry `padding`/`::before` hit expansion.
- Global `:focus-visible` ring (§3.3). Tab order: rail → prompt → actions → hand
  (left→right) → log. Cards are already `<button>`s — keep them.
- Keep `Enter`/`P`; add `←`/`→` to move focus within the fan and `Space` to toggle
  the focused card (natural for a button, currently implicit).
- `role="status"` regions: prompt line (exists) and a new polite live region
  announcing opponent plays (`"<name> played pair of 8s"`) — currently silent for
  screen readers.
- All icon-only buttons get `aria-label`. The felt, pods, and card backs are
  `aria-hidden` decorations except for the count text.
- Contrast: nothing below 4.5:1 for text, 3:1 for meaningful borders/icons. `ink-subtle`
  and `danger` are forbidden on felt (§3.1).

---

## 8. File plan

**Modify**
```
apps/web/src/app.css                     tokens, felt/noise, keyframes, prose retarget,
                                         DELETE .card-back/.mini-card/.rotate-overlay
apps/web/src/app.html                    font preload, theme-color meta, bg on <html>
apps/web/src/routes/+layout.svelte        shell wrapper class
apps/web/src/routes/play/+page.svelte     header → <Rail>, shell grid
apps/web/src/routes/online/+page.svelte   panels + lobby restyle, shell grid
apps/web/src/routes/+page.svelte          hero
apps/web/src/routes/rules/+page.svelte    prose container + section nav
apps/web/src/lib/components/Card.svelte       full face rebuild, size variants
apps/web/src/lib/components/Hand.svelte       fan geometry, arc, keyboard nav
apps/web/src/lib/components/Seat.svelte       pod + avatar + pulse
apps/web/src/lib/components/TrickPile.svelte  real cards on felt
apps/web/src/lib/components/ActionBar.svelte  buttons, kbd hints, toggle, combo summary
apps/web/src/lib/components/TurnBanner.svelte prompt line
apps/web/src/lib/components/LogDrawer.svelte  slide-over
apps/web/src/lib/components/GameTable.svelte  grid shell, felt, pod placement, deal targets
apps/web/static/favicon.svg               retoken (currently emerald-950 + serif ♠)
```

**Add**
```
apps/web/src/lib/components/Rail.svelte
apps/web/src/lib/components/CardBack.svelte
apps/web/src/lib/components/Avatar.svelte
apps/web/src/lib/components/Felt.svelte          (surface + rim + noise + vignette)
apps/web/src/lib/components/PlacingsPanel.svelte (hand/game over overlay)
apps/web/src/lib/ui.ts                           (seat offsets, fan transform math, name→hue)
apps/web/static/fonts/*.woff2
```

**Delete**
```
Scoreboard.svelte  (absorbed into Rail.svelte — test ids must move, not vanish)
.rotate-overlay + .rotate-icon rules and the overlay markup in GameTable.svelte
```

---

## 9. Phasing

Each phase must leave the app playable and the E2E suite green. Do not start a phase
before the previous one's acceptance check passes.

| Phase | Content | Acceptance |
|---|---|---|
| **P1 Foundation** | `@theme` tokens, font, focus ring, `app.html`, favicon; retarget existing components to tokens with **no layout change** | app renders with the new palette; contrast spot-checks match §3.1; all 3 specs green |
| **P2 Card system** | `Card.svelte` rebuild, `CardBack.svelte`, size variants, states | a 13-card hand at 40% overlap is fully identifiable from strips alone at 844×390 and 1440×900; `.play-card` count still 13 |
| **P3 Table** | shell grid, `Felt.svelte`, pod placement, `Rail.svelte`, `Seat.svelte` | zero document scroll at 320×568, 844×390, 882×344, 1280×720, 1440×900, 2560×1440; `document.scrollHeight === innerHeight`; 3 `[data-seat]` nodes |
| **P4 Play zone** | `TrickPile.svelte` real cards, prompt line, `ActionBar`, `PlacingsPanel`, log slide-over | `bomb.spec.ts` green unmodified (all four text assertions); exactly **one** "Game over" occurrence in `innerText` |
| **P5 Hand & motion** | fan geometry, portrait two-row dock, deal/play/sweep/pulse animations, keyboard nav | fan fits the §4.4 table within ±4px at all listed viewports; `.rotate-overlay` gone and portrait playable at 320px; reduced-motion kills all loops |
| **P6 Outer pages** | `/`, `/online`, `/rules` | every §0 test id present; `online.spec.ts` green |

---

## 10. Verification protocol (required before declaring done)

**Toolchain note:** `pnpm` in this repo requires Node ≥ 22 (`.nvmrc` = 24); the
default shell Node here is 20 and fails with `ERR_UNKNOWN_BUILTIN_MODULE: node:sqlite`.
Run everything with Node 24 on `PATH`.

1. `pnpm --filter web check` — zero errors.
2. `pnpm --filter web test:e2e` — all three specs green, **specs unmodified**. If a
   spec needs changing, the redesign broke a contract; fix the redesign.
3. Screenshot matrix, `/play?fast=1&seed=7` after Deal, at
   `320×568, 390×844, 844×390, 882×344, 1024×600, 1280×720, 1440×900, 2560×1440`.
   For each, assert programmatically:
   - `document.documentElement.scrollHeight <= innerHeight + 1`
   - `[data-testid=trick-pile]` rect fully inside the viewport (`y >= 0`)
   - `[data-hand]` height ≤ `card-h + 30` in landscape (single fan row)
   - every `button` hit box ≥ 44px in the smaller dimension, or has hit expansion
4. State coverage — capture and eyeball each: pre-deal, dealing mid-flight, your turn
   with legal highlights, invalid selection (reason + shake), opponent thinking,
   pass chips on felt, bomb flash, trick-won sweep, hand over, game over, 1-card-left
   opponent, online lobby (4 seats incl. bots), online connect error.
5. Contrast audit: sample every rendered text node's computed color against its
   painted background via canvas; fail on any pair < 4.5:1.
6. Reduced-motion run: `prefers-reduced-motion: reduce` — no looping animation, no
   flight; the game remains fully playable.

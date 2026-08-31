# Thirteen — Tiến Lên

Online multiplayer + vs-bots implementation of **Tiến Lên** (Southern Vietnamese
"Thirteen"), with a locked, test-enforced rules spec in [`RULES.md`](RULES.md).

**Play now:** [tienlen-thirteen.netlify.app](https://tienlen-thirteen.netlify.app)
**Source:** [github.com/jackietieu/thirteencardgame](https://github.com/jackietieu/thirteencardgame)

## Features

- **Vs bots** — local 4-player game against three bots with names, avatars, and
  a deterministic seeded deal (`?seed=`).
- **Online multiplayer** — 4-player rooms with a 4-letter join code, optional
  room password, shareable invite links, live chat, and reconnect-on-refresh.
- **Languages** — English, Vietnamese (Tiếng Việt), Mandarin (简体中文) and
  Cantonese (廣東話), switchable in-game from the language picker on every
  screen; the choice persists in `localStorage`.
- **Polished table UI** — animated dealing, trick pile, bomb flashes, move log,
  scoreboard, keyboard controls (`↵` play, `P` pass), and accessible card
  labels localized per language.

## Project structure

| Package            | Purpose                                                            |
| ------------------ | ------------------------------------------------------------------ |
| `packages/engine`  | Pure rules engine: deck, combos, bombs, trick resolution, scoring. |
| `packages/bots`    | Bot opponents (greedy strategy on top of the engine).              |
| `packages/protocol`| Shared client/server message types for online play.                |
| `apps/web`         | SvelteKit (Svelte 5) front end — table UI, lobby, rules page.      |
| `apps/server`      | Online room/chat server.                                           |

The rules engine is the executable spec: every numbered bullet in
[`RULES.md`](RULES.md) is enforced by at least one test in
`packages/engine/test/`. The UI additionally ships translations of the rules
page (`apps/web/src/lib/rules/`).

## Development

```sh
pnpm install
pnpm dev            # web app (SvelteKit)
pnpm test           # engine/bot unit tests + type checks
pnpm e2e            # Playwright end-to-end suite
```

Environment: copy `.env.example` to `.env.local` (Supabase + websocket server
config for online play).

## Deployment

The web app is statically built (`@sveltejs/adapter-static`) and served on
Netlify — [`netlify.toml`](netlify.toml) and [`fly.toml`](fly.toml) cover the
web + server deploys.

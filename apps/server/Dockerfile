# Thirteen game server — minimal Node image running the TS source directly
# via tsx (no build step). Build context is the repo root (pnpm workspace),
# so fly.toml lives there: `fly deploy` from the repository root.

FROM node:24-alpine
WORKDIR /app

RUN corepack enable

# Install dependencies first so source edits don't bust the layer cache.
# All workspace package.jsons are needed for the frozen lockfile to resolve.
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/protocol/package.json packages/protocol/
COPY packages/engine/package.json packages/engine/
COPY packages/bots/package.json packages/bots/
COPY apps/server/package.json apps/server/
RUN pnpm install --frozen-lockfile

COPY packages packages
COPY apps/server apps/server

ENV PORT=8787
EXPOSE 8787
CMD ["pnpm", "--filter", "@thirteen/server", "start"]

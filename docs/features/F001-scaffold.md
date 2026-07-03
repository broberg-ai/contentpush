# F001 — P1 Scaffold (Stack B foundation)

> Source spec: `contentpush_plan.md` (Plan v4) §3 architecture, §4 DB schema, §7 phase P1.
> Adopted into cardmem 2026-07-03 (Branch B). Nothing shipped yet → Backlog.

## Motivation
Contentpush is a greenfield internal tool. Before any content, media, notification, or dashboard work can start, the repo needs a working Stack B skeleton that everything else (F002–F006) builds on: a Bun + Hono server, a Preact + Vite SPA, `@broberg/theme` design tokens, and a Turso/Drizzle database. This epic delivers the empty-but-running shell.

## Scope
- Bun + Hono + Preact + Vite monorepo under `apps/web` (plan §3 layout).
- `@broberg/theme` v0.3.1 tokens embedded (`tokens.css`); earth-tone + serif design paradigm; **no** shadcn/Tailwind.
- Turso DB via `@broberg/db-sdk` v0.1.0 + Drizzle schema (`posts`, `media_library`, `settings`) per plan §4.
- `@broberg/config` v0.2.0 single-source env; `.env.example`; ship-dark pattern for missing secrets.

## Non-goals
- No content generation, media, notifications, cron, or dashboard logic — those are F002–F006.
- No `@broberg/stack-b-base` dependency yet (🚧 not shipped) — bootstrap manually, migrate when it lands.
- No auth/multi-user (`@broberg/auth`/`apikey`) — single user (Christian) for v1.

## Architecture (plan §3)
```
apps/web/
  src/server/   index.ts (Hono), routes/, db/schema.ts (Drizzle→Turso)
  src/client/   main.tsx (Preact), components/, styles/tokens.css (@broberg/theme)
.env            # never committed
```

## Dependencies
`@broberg/theme` v0.3.1 · `@broberg/config` v0.2.0 · `@broberg/db-sdk` v0.1.0 — all shipped.

## Rollout
Local dev only. `bun run dev` boots server + SPA. Nothing reaches users; env-gated integrations stay dark.

## Stories
- **F001.1** — Bootstrap Bun+Hono+Preact+Vite monorepo (`bun run dev` boots).
- **F001.2** — Embed `@broberg/theme` tokens + base layout shell.
- **F001.3** — Turso DB + Drizzle schema (posts/media_library/settings).
- **F001.4** — `@broberg/config` env + `.env.example` + ship-dark pattern.

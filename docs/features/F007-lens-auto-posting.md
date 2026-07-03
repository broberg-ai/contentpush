# F007 — v2 Automated posting via Lens (spike)

> Source spec: `contentpush_plan.md` (Plan v4) §8 roadmap (v2). **Roadmap epic — later tier.** Depends on v1 being built + in use.

## Motivation
v1 is deliberately manual (zero API risk, zero approval process). Once it's running, the natural next step is to remove the manual posting step — but via **browser automation** rather than chasing official API access first. `@broberg/lens` already drives Playwright + pixelmatch (the Storeform App-Store-Connect pattern), so we reuse it instead of building anything new.

## Scope (spike)
- A single, isolated spike: post one real draft to one platform via `@broberg/lens`, and **visually verify** (Lens' core competency) that it actually published.
- Keep the v1 dashboard's download/manual-post path fully intact as the fallback.

## Trade-offs (from §8)
- **Pro:** avoids API approval + rate-limits; reuses existing infra + pattern.
- **Con:** fragile against platform UI changes; requires visual verification to trust it.

## Non-goals
- No big-bang migration off manual posting. No official API work (that's F008, only if this proves too fragile).

## Dependencies
- v1 complete (F001–F006), specifically F005 (the manual dashboard/fallback) must exist first.
- `@broberg/lens` (via the cardmem-lens MCP / daemon).

## Stories
- **F007.1** — Spike: post one real draft to one platform via @broberg/lens + Lens-verify it landed; v1 fallback preserved.

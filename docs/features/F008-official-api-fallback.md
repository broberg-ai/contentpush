# F008 — v3 Official platform API (fallback)

> Source spec: `contentpush_plan.md` (Plan v4) §8 roadmap (v3). **Roadmap epic — later tier, conditional.** Depends on F007's outcome.

## Motivation
Official API integration (LinkedIn Share API, Meta Graph API) was the whole of the original v1/v2 drafts — deliberately dropped because of approval process + compliance risk. It returns here only as a **fallback**: if the v2 Lens automation (F007) turns out too fragile in practice (platform UI changes, bot detection), official APIs become the durable path.

## Scope (conditional)
- Trigger: F007 proves too fragile in real use.
- First step is an **evaluation / decision doc** (which platforms justify the approval cost, what each API supports), not an immediate build.
- Then, if justified, integrate the relevant official API(s) behind the same dashboard.

## Non-goals
- Not pursued while Lens automation is good enough. Not a v1/v2 deliverable.

## Dependencies
- F007 (must be tried first). This epic stays dormant until its outcome is known.

## Stories
- **F008.1** — Evaluate official API integration IF F007 proves too fragile (decision doc + scoped spike).

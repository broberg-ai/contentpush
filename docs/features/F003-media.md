# F003 — P3 Media (stock library, transform, AI image)

> Source spec: `contentpush_plan.md` (Plan v4) §1 step 2, §2 (@broberg/media, media-transform), §6.1 open decision, §7 phase P3. Depends on F001.

## Motivation
Every post needs a visual. Contentpush should either pull from your own stock library or generate an on-brand image, then normalize it so the download package is consistent. This epic delivers the media plumbing.

## Scope
- `@broberg/media` v0.1.0 stock-image library: upload, store, list (`LibraryGrid`).
- `@broberg/media-transform` v0.1.0 ingest pipeline: HEIC→WebP, responsive sizes.
- AI image generation — **pending the §6.1 provider decision** (see Open decision).
- Video handled only as raw files via `@broberg/media` (no auto-generation) — v1 = text + images; video is v2.

## Open decision (§6.1 — resolve in cardmem, do NOT silently pick)
`@broberg/ai-sdk` is LLM/text-focused; there is **no** image-generation package in the portfolio, and Mistral has no first-party image model. Options:
- **(a)** Route via a model already inside the ai-sdk boundary (e.g. DeepInfra) **if** it offers an image model — keeps the one-boundary principle.
- **(b)** A separate external image provider outside `@broberg/ai-sdk` — **breaks** the one-model-boundary principle, so must be a deliberate, logged choice.
Until decided, **F003.3 stays parked in Backlog, blocked.**

## Non-goals
- No dashboard rendering (F005), no video generation, no posting.

## Dependencies
- F001. `@broberg/media` v0.1.0, `@broberg/media-transform` v0.1.0 — shipped.

## Stories
- **F003.1** — `@broberg/media` stock-image library: upload / store / list.
- **F003.2** — `@broberg/media-transform` ingest (HEIC→WebP, responsive sizes).
- **F003.3** — AI image generation — BLOCKED on §6.1 provider decision.

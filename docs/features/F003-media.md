# F003 — P3 Media (stock library, transform, AI image)

> Source spec: `contentpush_plan.md` (Plan v4) §1 step 2, §2 (@broberg/media, media-transform), §6.1 (now resolved), §7 phase P3. Depends on F001.

## Motivation
Every post needs a visual. Contentpush should either pull from your own stock library or generate an on-brand image, then normalize it so the download package is consistent. This epic delivers the media plumbing.

## Scope
- `@broberg/media` v0.1.0 stock-image library: upload, store, list (`LibraryGrid`).
- `@broberg/media-transform` v0.1.0 ingest pipeline: HEIC→WebP, responsive sizes.
- AI image generation via `@broberg/ai-sdk` (see Resolved decision).
- Video handled only as raw files via `@broberg/media` (no auto-generation) — v1 = text + images; video is v2.

## Resolved decision (§6.1 — settled 2026-07-03)
The plan's premise ("ai-sdk is text-only, no image package") was **outdated**. Confirmed via `discovery.broberg.ai` + directly by the **ai-sdk** owner (intercom #15569, code-checked) and **components** (#15570, proven on the Sanne pilot):

- **Provider = `@broberg/ai-sdk` v0.21.0 `ai.image()`** (FLUX 2 / Black Forest Labs). There is **no** separate `@broberg/image` package — all AI (text/vision/image) goes through the ai-sdk facade; a raw BFL/fal/FLUX call is the reuse anti-pattern. Route by tier, not model-string.
- **On-brand images:** `ai.trainStyle({images})` trains a brand LoRA (~$2 once) → `ai.image({prompt, lora})` (~$0.025/img) for a recognizable brand look instead of generic stock-AI.
- **Cost:** auto-tracked through the same cost-sink as chat (no special-casing).

### ⚠️ GDPR residency split (hard constraint)
- `ai.image()` **generation** default = **EU** (BFL, Paris-hosted).
- `ai.trainStyle()` **LoRA training** runs on **fal.ai = US-hosted, NOT EU-pinned**.
- ⇒ **Training images MUST be brand-only** (logos/products/visuals) with **no faces / personal data**. If a personal likeness is ever needed, use the **BFL EU portrait path + explicit consent** — never an auto-fallback to a US/CN model for personal data.

### Open product choice (build-time, non-blocking)
Are Contentpush's AI images purely brand visuals (→ `trainStyle` as above), or will they feature people (→ BFL EU portrait path + consent)? Christian confirms when F003.3 is picked up.

## Non-goals
- No dashboard rendering (F005), no video generation, no posting.
- **Stock library** is not in the shared inventory — build locally on `@broberg/media`; if ≥1 other repo will need a stock layer, file a `@broberg/stock` gap to `components` first (reuse-first).

## Dependencies
- F001. `@broberg/media` v0.1.0, `@broberg/media-transform` v0.1.0, `@broberg/ai-sdk` v0.21.0 — shipped.

## Stories
- **F003.1** — `@broberg/media` stock-image library: upload / store / list.
- **F003.2** — `@broberg/media-transform` ingest (HEIC→WebP, responsive sizes).
- **F003.3** — AI image generation via `@broberg/ai-sdk` `ai.image()` + `trainStyle` (§6.1 resolved).

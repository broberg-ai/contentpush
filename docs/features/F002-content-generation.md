# F002 — P2 Content generation (AI text + hashtags)

> Source spec: `contentpush_plan.md` (Plan v4) §1 concept step 1, §2 (@broberg/ai-sdk), §7 phase P2. Depends on F001.

## Motivation
The core value of Contentpush is turning a single headline + brand context into ready-to-post copy for three platforms, every 14 days, without the administrative friction. This epic delivers the text half of a draft (the image half is F003).

## Scope
- `@broberg/ai-sdk` (Mistral, EU) integration generating **LinkedIn / Instagram / Facebook** text variants + per-platform hashtags from `headline` + `companyContext`.
- A brand-context / brand-voice settings form (`companyIntro`, `brandVoice`) persisted to `settings`, reused across all posts.
- Cost logging via `@upmetrics/sdk` on every generation call.

## Non-goals
- No image generation/selection (F003), no dashboard rendering (F005), no scheduling (F004).
- No provider other than Mistral for v1 (single model boundary).

## Dependencies
- F001 (schema + config must exist).
- `@broberg/ai-sdk` v0.17.1, `@upmetrics/sdk` v0.2.0 — shipped.

## Rollout
Backend route `generate.ts` callable from dev; brand-context form wired to `settings`. No external posting.

## Stories
- **F002.1** — `@broberg/ai-sdk` text+hashtag generation for the 3 platforms (+ upmetrics cost log).
- **F002.2** — Brand-context / brand-voice settings form persisted to `settings`.

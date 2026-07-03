# F006 — P6 Polish (secret-scan CI, cost logging)

> Source spec: `contentpush_plan.md` (Plan v4) §2, §7 phase P6. Depends on all v1 epics.

## Motivation
Before Contentpush is trusted with real webhook URLs and AI keys, two guardrails must exist: secrets can never leak into git, and AI spend is visible. Small epic, real safety.

## Scope
- `@broberg/secret-scan` v0.1.5 in CI — blocking gate against committed Discord webhook URLs / AI keys.
- `@upmetrics/sdk` v0.2.0 cost logging across all AI generation (text now; image once F003.3 is enabled), per the F113 pattern.

## Non-goals
- No new product surface — hardening only.

## Dependencies
- Rides on F002 (AI calls to instrument) and the repo/CI from F001. `@broberg/secret-scan` v0.1.5, `@upmetrics/sdk` v0.2.0 — shipped.

## Rollout
CI gate active on every push; cost telemetry flowing to the upmetrics project.

## Stories
- **F006.1** — `@broberg/secret-scan` blocking CI gate.
- **F006.2** — `@upmetrics/sdk` cost logging across AI generation (F113 pattern).

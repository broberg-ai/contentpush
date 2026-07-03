# F004 — P4 Notifications + Cron (Discord, 14-day trigger)

> Source spec: `contentpush_plan.md` (Plan v4) §1 step 3, §2, §5 (notify stub), §7 phase P4. Depends on F001.

## Motivation
Contentpush is a background rhythm, not an app you remember to open. A 14-day cron trigger generates the next draft, and Discord notifications pull you in at the two moments that matter: "a draft is ready to review" and "it's time to post today".

## Scope
- Discord webhook notifier — a **temporary** ship-dark stub (`routes/discord.ts`, raw `fetch`) sending "🎨 draft ready" and "✅ time to post". Loose-coupled so `@broberg/notify` (Discord + Slack, under development) drops in trivially.
- `@broberg/cron` v0.1.0 integration: 14-day trigger + `cron-hook.ts` route that generates the next draft (calls into F002).
- Auto-schedule next post +14 days (`settings.postingIntervalDays`, default 14).

## Non-goals
- No automated **posting** (that's the v2 Lens roadmap, F007) — notifications only.
- No building a durable in-repo notifier — wait for `@broberg/notify` per plan §5.
- No `@broberg/webpush` (browser push) in v1 — Discord webhook only.

## Dependencies
- F001. Generation path from F002 (cron-hook triggers a draft). `@broberg/cron` v0.1.0 — shipped. `@broberg/notify` — 🔜 not yet shipped (stub until then).

## Rollout
Ship-dark: with no webhook URL / cron registration, the app runs and simply skips notify. Register the cron job on cronjobs.webhouse.net when going live.

## Stories
- **F004.1** — Discord webhook notify stub (ship-dark, loose-coupled) for draft-ready + time-to-post.
- **F004.2** — `@broberg/cron` 14-day trigger + `cron-hook` route; auto-schedule next post +14d.

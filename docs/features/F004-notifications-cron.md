# F004 — P4 Notifications + Cron (@broberg/notify + 14-day trigger)

> Source spec: `contentpush_plan.md` (Plan v4) §1 step 3, §2, §5 (stub — now superseded), §7 phase P4. Depends on F001.

## Motivation
Contentpush is a background rhythm, not an app you remember to open. A 14-day cron trigger generates the next draft, and notifications pull Christian in at the two moments that matter: "a draft is ready to review" and "it's time to post today".

## Update (2026-07-03): the §5 stub is obsolete
Plan §5 specified a *temporary raw-fetch Discord stub* "until `@broberg/notify` lands". **It landed during adoption** — `@broberg/notify@0.1.0` is live on npm (components #15596). So F004 is built on the package from the start; no throwaway stub.

```ts
import { createNotifier } from "@broberg/notify";
const notify = createNotifier({
  discord: { webhookUrl: process.env.DISCORD_WEBHOOK }, // unset = dark-shipped, no crash
  slack:   { webhookUrl: process.env.SLACK_WEBHOOK },   // optional
});
await notify.send({ title: "Klar til gennemsyn", text: "📸 Dit opslag er klar", url: reviewUrl });
// → ChannelResult[] { channel, ok, status?, error? } — per-channel isolation
```

## Scope
- Notifications via `@broberg/notify@0.1.0` (exact-pin): "🎨 draft ready to review" + "✅ time to post today", each with a deep-link to the dashboard.
- `@broberg/cron` v0.1.0: 14-day trigger + `cron-hook.ts` route that generates the next draft (calls into F002).
- Auto-schedule next post +14 days (`settings.postingIntervalDays`, default 14).

## Non-goals
- No automated **posting** (that's the v2 Lens roadmap, F007) — notifications only.
- No raw/bespoke notifier — use `@broberg/notify`. No mail (`@broberg/mail`) or browser-push (`@broberg/webpush`) in v1.

## Dark-ship + reuse
- Zero configured channels ⇒ inert no-op (`send → []`, never throws) — safe before `DISCORD_WEBHOOK` is set.
- Per-channel isolation: if Discord is down, Slack still posts; result is per-channel.
- Missing a capability (per-call channel targeting, embeds, a Teams/Telegram channel)? File a gap to `components` — don't hand-roll.

## Dependencies
- F001. Generation path from F002 (cron-hook triggers a draft). `@broberg/cron` v0.1.0, `@broberg/notify` v0.1.0 — shipped.

## Rollout
Dark-ship: with no webhook URL / cron registration, the app runs and simply skips notify. Register the cron job on cronjobs.webhouse.net when going live.

## Stories
- **F004.1** — Notifications via `@broberg/notify` (draft-ready + time-to-post).
- **F004.2** — `@broberg/cron` 14-day trigger + `cron-hook` route; auto-schedule next post +14d.

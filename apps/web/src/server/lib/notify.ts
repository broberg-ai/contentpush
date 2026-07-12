import { createNotifier } from "@broberg/notify";
import { env } from "../env";

// @broberg/notify (exact-pin 0.1.0) — dark-ship: ingen konfigurerede kanaler
// = inert no-op (send → [], throw'er aldrig). Per-kanal isolation indbygget.
const notifier = createNotifier({
  discord: { webhookUrl: env.DISCORD_WEBHOOK_URL ?? "" },
});

// F009.2: prod-URL fra APP_PUBLIC_URL (én kilde), localhost-fallback i dev.
const APP_URL = env.APP_PUBLIC_URL ?? `http://127.0.0.1:${env.PORT}`;

/** Deep-link direkte til det pågældende brands kø (?brand=<id> → SPA'en åbner kø-viewet filtreret). */
function brandQueueUrl(brandId: string): string {
  return `${APP_URL}/?brand=${encodeURIComponent(brandId)}`;
}

/** "🎨 Nyt udkast klar til gennemsyn" — sendes når cron-hook har genereret et draft. */
export function notifyDraftReady(input: { brandId: string; brandName: string; headline: string }) {
  return notifier.send({
    title: "🎨 Nyt udkast klar til gennemsyn",
    text: `${input.brandName}: "${input.headline}" er genereret og venter i køen.`,
    url: brandQueueUrl(input.brandId),
  });
}

/** "✅ Tid til at poste i dag" — sendes når en ready-post når sin scheduledDate. */
export function notifyTimeToPost(input: { brandId: string; brandName: string; headline: string }) {
  return notifier.send({
    title: "✅ Tid til at poste i dag",
    text: `${input.brandName}: "${input.headline}" er godkendt og planlagt til i dag — download pakken og post.`,
    url: brandQueueUrl(input.brandId),
  });
}

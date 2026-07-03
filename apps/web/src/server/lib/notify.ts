import { createNotifier } from "@broberg/notify";
import { env } from "../env";

// @broberg/notify (exact-pin 0.1.0) — dark-ship: ingen konfigurerede kanaler
// = inert no-op (send → [], throw'er aldrig). Per-kanal isolation indbygget.
const notifier = createNotifier({
  discord: { webhookUrl: env.DISCORD_WEBHOOK_URL ?? "" },
});

const APP_URL = `http://127.0.0.1:${env.PORT}`; // dashboard-deep-link; prod-URL når vi deployer

/** "🎨 Nyt udkast klar til gennemsyn" — sendes når cron-hook har genereret et draft. */
export function notifyDraftReady(input: { brandName: string; headline: string }) {
  return notifier.send({
    title: "🎨 Nyt udkast klar til gennemsyn",
    text: `${input.brandName}: "${input.headline}" er genereret og venter i køen.`,
    url: APP_URL,
  });
}

/** "✅ Tid til at poste i dag" — sendes når en ready-post når sin scheduledDate. */
export function notifyTimeToPost(input: { brandName: string; headline: string }) {
  return notifier.send({
    title: "✅ Tid til at poste i dag",
    text: `${input.brandName}: "${input.headline}" er godkendt og planlagt til i dag — download pakken og post.`,
    url: APP_URL,
  });
}

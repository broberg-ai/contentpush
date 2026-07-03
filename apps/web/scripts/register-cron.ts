import { createCron } from "@broberg/cron";
import { env } from "../src/server/env";

// Registrerer (upsert via externalId) den daglige tick på cronjobs.webhouse.net.
// Ship-dark: kræver CRONJOBS_API_TOKEN (scoped 'contentpush', mintet af buddy)
// og APP_PUBLIC_URL (sættes når contentpush deployes — cron-servicen kan ikke
// nå 127.0.0.1). Daglig kadence: tick'en afgør selv per brand om noget er due.
if (!env.CRONJOBS_API_TOKEN) {
  console.warn("[ship-dark] CRONJOBS_API_TOKEN ikke sat — springer cron-registrering over");
  process.exit(0);
}
if (!env.APP_PUBLIC_URL) {
  console.warn("[ship-dark] APP_PUBLIC_URL ikke sat (ikke deployet endnu) — springer cron-registrering over");
  process.exit(0);
}

const cron = createCron({ token: env.CRONJOBS_API_TOKEN });
const job = await cron.createJob({
  name: "contentpush daily tick",
  schedule: "0 6 * * *", // dagligt kl 06 UTC
  url: `${env.APP_PUBLIC_URL}/api/cron/tick`,
  method: "POST",
  ...(env.CRON_HOOK_SECRET ? { headers: { "x-cron-key": env.CRON_HOOK_SECRET } } : {}),
  externalId: "contentpush:daily-tick",
});
console.log("cron-job registreret:", job.id, job.schedule, job.url);

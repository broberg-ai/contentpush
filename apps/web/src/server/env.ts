import "dotenv/config";
import { z } from "zod";
import { parseEnv } from "@broberg/config";

// Én kilde for al env (F001.4). Læs ALDRIG process.env direkte i app-kode —
// importér `env` herfra. Alle secrets er optional = ship-dark: manglende
// værdi degraderer (lokal DB, notify springes over), crasher aldrig boot.
// OBS: projekt-præfiksede DB-vars — generisk TURSO_DATABASE_URL lækkede fra
// det arvede miljø (tmux-global; buddy-cloud-hændelsen 2026-07-03), se db/index.ts.
export const env = parseEnv(
  z.object({
    PORT: z.coerce.number().int().positive().default(3019),
    CONTENTPUSH_TURSO_URL: z.string().min(1).optional(),
    CONTENTPUSH_TURSO_TOKEN: z.string().min(1).optional(),
    DISCORD_WEBHOOK_URL: z.string().url().optional(),
    MISTRAL_API_KEY: z.string().min(1).optional(),
    // fal — brand-billeder (INGEN persondata/ansigter i prompt ⇒ GDPR-ok uden EU-krav).
    // BFL (EU, Paris) er PORTRÆT-vejen (Christians likeness, F009.3) — kun reference/finetune.
    FAL_KEY: z.string().min(1).optional(),
    BFL_API_KEY: z.string().min(1).optional(),
    UPMETRICS_API_KEY: z.string().min(1).optional(),
    UPMETRICS_DSN: z.string().url().optional(),
    // CONTENTPUSH_-præfiks: generiske R2_*-vars lækker fra det arvede miljø
    // (buddys tmux-global — _ID/_BUCKET/_ENDPOINT-suffikser rammer ikke
    // secret-scrubben; samme klasse som TURSO-hændelsen)
    CONTENTPUSH_R2_ACCOUNT_ID: z.string().min(1).optional(),
    CONTENTPUSH_R2_ACCESS_KEY_ID: z.string().min(1).optional(),
    CONTENTPUSH_R2_SECRET_ACCESS_KEY: z.string().min(1).optional(),
    CONTENTPUSH_R2_BUCKET: z.string().min(1).optional(),
    CRONJOBS_API_TOKEN: z.string().min(1).optional(),
    APP_PUBLIC_URL: z.string().url().optional(),
    CRON_HOOK_SECRET: z.string().min(1).optional(),
    // F011.2: adgangsnøgle til dashboardet (usat = gate inaktiv, lokal dev)
    DASHBOARD_ACCESS_KEY: z.string().min(1).optional(),
    // F010.1: AutoDoc consumer-tokens (per-projekt bearer, read-only, ship-dark)
    AUTODOC_KEY_BROBERG_AI: z.string().min(1).optional(),
    AUTODOC_KEY_CARDMEM_COM: z.string().min(1).optional(),
    AUTODOC_KEY_TRAILMEM_COM: z.string().min(1).optional(),
  }),
);

/** Ship-dark-status: [varnavn, konsekvens når den mangler] for alt der er mørkt. */
export function darkSecrets(): Array<[name: string, consequence: string]> {
  const checks: Array<[string, string | undefined, string]> = [
    ["CONTENTPUSH_TURSO_URL", env.CONTENTPUSH_TURSO_URL, "kører på lokal fil-DB (dev)"],
    ["DISCORD_WEBHOOK_URL", env.DISCORD_WEBHOOK_URL, "notifikationer springes over"],
    ["MISTRAL_API_KEY", env.MISTRAL_API_KEY, "AI-tekstgenerering svarer 503"],
    ["FAL_KEY", env.FAL_KEY, "billed-generering springes over (stories får imagePending)"],
    ["UPMETRICS_API_KEY", env.UPMETRICS_API_KEY, "AI-cost logges ikke til upmetrics"],
    ["UPMETRICS_DSN", env.UPMETRICS_DSN, "runtime-fejl fanges ikke af upmetrics"],
    ["CONTENTPUSH_R2_ACCESS_KEY_ID", env.CONTENTPUSH_R2_ACCESS_KEY_ID, "media-upload svarer 503 (mangler R2-creds)"],
  ];
  return checks
    .filter(([, value]) => !value)
    .map(([name, , consequence]) => [name, consequence]);
}

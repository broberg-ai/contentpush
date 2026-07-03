import "dotenv/config";
import { z } from "zod";
import { parseEnv } from "@broberg/config";

// Én kilde for al env (F001.4). Læs ALDRIG process.env direkte i app-kode —
// importér `env` herfra. Alle secrets er optional = ship-dark: manglende
// værdi degraderer (lokal DB, notify springes over), crasher aldrig boot.
// OBS: projekt-præfiksede DB-vars — generisk TURSO_DATABASE_URL lækker fra
// shell-profilen (buddy-cloud-hændelsen 2026-07-03), se db/index.ts.
export const env = parseEnv(
  z.object({
    PORT: z.coerce.number().int().positive().default(3019),
    CONTENTPUSH_TURSO_URL: z.string().min(1).optional(),
    CONTENTPUSH_TURSO_TOKEN: z.string().min(1).optional(),
    DISCORD_WEBHOOK_URL: z.string().url().optional(),
  }),
);

/** Ship-dark-status: [varnavn, konsekvens når den mangler] for alt der er mørkt. */
export function darkSecrets(): Array<[name: string, consequence: string]> {
  const checks: Array<[string, string | undefined, string]> = [
    ["CONTENTPUSH_TURSO_URL", env.CONTENTPUSH_TURSO_URL, "kører på lokal fil-DB (dev)"],
    ["DISCORD_WEBHOOK_URL", env.DISCORD_WEBHOOK_URL, "notifikationer springes over"],
  ];
  return checks
    .filter(([, value]) => !value)
    .map(([name, , consequence]) => [name, consequence]);
}

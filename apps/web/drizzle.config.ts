import { defineConfig } from "drizzle-kit";

// Samme kilde som src/server/db/index.ts: CONTENTPUSH_TURSO_URL i cloud,
// lokal libSQL-fil som dev-fallback (projekt-præfikset — se db/index.ts:
// den generiske TURSO_DATABASE_URL lækker fra shell-profilen og fik turso-
// dialekten til at "no-op'e" stille mod en fremmed, uautoriseret remote).
const tursoUrl = process.env.CONTENTPUSH_TURSO_URL;

export default defineConfig({
  schema: "./src/server/db/schema.ts",
  out: "./drizzle",
  ...(tursoUrl
    ? {
        dialect: "turso" as const,
        dbCredentials: { url: tursoUrl, authToken: process.env.CONTENTPUSH_TURSO_TOKEN },
      }
    : {
        dialect: "sqlite" as const,
        dbCredentials: { url: "file:./.data/contentpush.db" },
      }),
});

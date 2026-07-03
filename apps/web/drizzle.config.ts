import { defineConfig } from "drizzle-kit";
import { env } from "./src/server/env";

// Samme kilde som appen (env.ts — projekt-præfiksede vars; den generiske
// TURSO_DATABASE_URL lækkede fra det arvede miljø og fik turso-dialekten til at
// "no-op'e" stille mod en fremmed, uautoriseret remote — se db/index.ts).
const tursoUrl = env.CONTENTPUSH_TURSO_URL;

export default defineConfig({
  schema: "./src/server/db/schema.ts",
  out: "./drizzle",
  ...(tursoUrl
    ? {
        dialect: "turso" as const,
        dbCredentials: { url: tursoUrl, authToken: env.CONTENTPUSH_TURSO_TOKEN },
      }
    : {
        dialect: "sqlite" as const,
        dbCredentials: { url: "file:./.data/contentpush.db" },
      }),
});

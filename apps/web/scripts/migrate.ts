import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { createClient } from "@broberg/db-sdk";
import { env } from "../src/server/env";

// Samme kilde som appen (env.ts — projekt-præfiksede vars, se db/index.ts).
// Runtime-migratoren er den kanoniske sti: én kodesti for både dev-fil og
// Turso, gennem samme @broberg/db-sdk-client som appen selv.
const url = env.CONTENTPUSH_TURSO_URL ?? "file:./.data/contentpush.db";

const db = drizzle(
  createClient({ url, authToken: env.CONTENTPUSH_TURSO_TOKEN }),
);

await migrate(db, { migrationsFolder: "./drizzle" });
console.log("migrations applied →", url);

import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { createClient } from "@broberg/db-sdk";

// Samme kilde-logik som src/server/db/index.ts — projekt-præfiksede vars
// (den generiske TURSO_DATABASE_URL lækker fra shell-profilen, se db/index.ts).
// Runtime-migratoren er den kanoniske sti: én kodesti for både dev-fil og
// Turso, gennem samme @broberg/db-sdk-client som appen selv.
const url = process.env.CONTENTPUSH_TURSO_URL ?? "file:./.data/contentpush.db";

const db = drizzle(
  createClient({ url, authToken: process.env.CONTENTPUSH_TURSO_TOKEN }),
);

await migrate(db, { migrationsFolder: "./drizzle" });
console.log("migrations applied →", url);

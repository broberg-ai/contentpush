import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@broberg/db-sdk";
import * as schema from "./schema";

// PROJEKT-PRÆFIKSEDE vars med vilje: den generiske TURSO_DATABASE_URL lækker
// fra shell-profilen og pegede på buddy-clouds DB (opdaget 2026-07-03) — et
// forkert-DB-foot-gun. Contentpush læser KUN sine egne vars.
// Ship-dark: uden CONTENTPUSH_TURSO_URL kører vi på en lokal libSQL-fil (dev).
const url = process.env.CONTENTPUSH_TURSO_URL ?? "file:./.data/contentpush.db";

export const db = drizzle(
  createClient({ url, authToken: process.env.CONTENTPUSH_TURSO_TOKEN }),
  { schema },
);

export * as tables from "./schema";

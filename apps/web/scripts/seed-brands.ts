import { eq } from "drizzle-orm";
import { db, tables } from "../src/server/db";

// De tre første brands (Christian 2026-07-03). Idempotent: springer over hvis
// navnet allerede findes. Kontekst/voice udfyldes af Christian i formen (F002.2)
// eller foreslås af Discovery-analyzeren (F010).
const FIRST_BRANDS = [
  { name: "broberg.ai", siteUrl: "https://broberg.ai" },
  { name: "cardmem.com", siteUrl: "https://cardmem.com" },
  { name: "trailmem.com", siteUrl: "https://trailmem.com" },
];

for (const brand of FIRST_BRANDS) {
  const [existing] = await db
    .select()
    .from(tables.brandProfiles)
    .where(eq(tables.brandProfiles.name, brand.name));
  if (existing) {
    console.log(`findes allerede: ${brand.name}`);
    continue;
  }
  await db.insert(tables.brandProfiles).values(brand);
  console.log(`seedet: ${brand.name}`);
}

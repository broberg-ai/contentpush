import { Hono } from "hono";
import { desc, eq } from "drizzle-orm";
import { ai } from "../lib/ai";
import { db, tables } from "../db";
import { env } from "../env";
import { generatePostTexts } from "./generate";
import { notifyDraftReady, notifyTimeToPost } from "../lib/notify";

// Udkastet genereres LEAD dage før posting-dagen, så der er review-tid.
const GENERATION_LEAD_DAYS = 3;

const DAY_MS = 24 * 60 * 60 * 1000;
const addDays = (d: Date, days: number) => new Date(d.getTime() + days * DAY_MS);
const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

async function suggestHeadline(brand: {
  name: string;
  companyContext: string | null;
  brandVoice: string | null;
}): Promise<string> {
  const { text } = await ai.chat({
    prompt: [
      `Foreslå ÉN kort, konkret dansk headline til det næste social media-opslag for brandet "${brand.name}".`,
      brand.companyContext ? `Brand-kontekst: ${brand.companyContext}` : "",
      brand.brandVoice ? `Tone: ${brand.brandVoice}` : "",
      "Svar KUN med selve headline-teksten — ingen anførselstegn, ingen forklaring.",
    ]
      .filter(Boolean)
      .join("\n"),
    tier: "cheap",
  });
  return text.trim().replace(/^["“]|["”]$/g, "");
}

/**
 * Daglig tick fra cronjobs.webhouse.net (via @broberg/cron-registrering).
 * Per brand: genererer næste udkast når det er due (sidste post + interval,
 * minus LEAD-dage), og sender "tid til at poste" for ready-posts med
 * scheduledDate i dag. Idempotens: et eksisterende draft/ready blokerer ny
 * generering; time-to-post fyrer kun på selve dagen (daglig tick = én notify).
 */
export const cronHookRoute = new Hono().post("/tick", async (c) => {
  if (env.CRON_HOOK_SECRET && c.req.header("x-cron-key") !== env.CRON_HOOK_SECRET) {
    return c.json({ error: "Ugyldig cron-nøgle" }, 401);
  }

  const now = new Date();
  const brands = await db.select().from(tables.brandProfiles);
  const report: Array<Record<string, unknown>> = [];

  for (const brand of brands) {
    const [newest] = await db
      .select()
      .from(tables.posts)
      .where(eq(tables.posts.brandId, brand.id))
      .orderBy(desc(tables.posts.createdAt))
      .limit(1);

    const interval = brand.postingIntervalDays;
    const due =
      !newest ||
      (newest.status === "posted" &&
        newest.postedAt !== null &&
        addDays(newest.postedAt, interval - GENERATION_LEAD_DAYS) <= now);

    if (due) {
      try {
        const headline = await suggestHeadline(brand);
        const { content } = await generatePostTexts({
          headline,
          companyContext: brand.companyContext ?? undefined,
          brandVoice: brand.brandVoice ?? undefined,
          platforms: brand.platforms ?? undefined,
        });
        const scheduledDate = newest?.postedAt
          ? addDays(newest.postedAt, interval)
          : addDays(now, GENERATION_LEAD_DAYS);
        await db.insert(tables.posts).values({
          brandId: brand.id,
          headline,
          linkedinText: content.linkedin?.text,
          instagramText: content.instagram?.text,
          facebookText: content.facebook?.text,
          hashtags: Object.fromEntries(
            Object.entries(content).map(([p, v]) => [p, v.hashtags]),
          ),
          scheduledDate,
        });
        await notifyDraftReady({ brandName: brand.name, headline });
        report.push({ brand: brand.name, generated: headline, scheduledDate });
      } catch (err) {
        // Ship-dark: én brands fejl (fx manglende AI-nøgle) stopper ikke de andre
        report.push({
          brand: brand.name,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // "Tid til at poste i dag" for godkendte posts med scheduledDate i dag
    const brandPosts = await db
      .select()
      .from(tables.posts)
      .where(eq(tables.posts.brandId, brand.id));
    for (const p of brandPosts) {
      if (p.status === "ready" && p.scheduledDate && sameDay(p.scheduledDate, now)) {
        await notifyTimeToPost({ brandName: brand.name, headline: p.headline });
        report.push({ brand: brand.name, timeToPost: p.headline });
      }
    }
  }

  return c.json({ ok: true, at: now.toISOString(), report });
});

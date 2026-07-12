import { Hono } from "hono";
import { and, asc, eq, isNull, ne } from "drizzle-orm";
import { ai } from "../lib/ai";
import { db, tables } from "../db";
import { env } from "../env";
import { generatePostTexts } from "./generate";
import { generateStoryImage, imageAvailable } from "../lib/images";
import { notifyDraftReady, notifyTimeToPost } from "../lib/notify";

// F012.2: pipelinen holder altid ≥TARGET_BUFFER fremtidige stories per brand.
const TARGET_BUFFER = 5;
// Første story for et brand uden historik planlægges LEAD dage ude (review-tid).
const GENERATION_LEAD_DAYS = 3;

const DAY_MS = 24 * 60 * 60 * 1000;
const addDays = (d: Date, days: number) => new Date(d.getTime() + days * DAY_MS);
const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

async function suggestHeadline(
  brand: {
    name: string;
    companyContext: string | null;
    brandVoice: string | null;
  },
  usedHeadlines: string[],
): Promise<string> {
  const { text } = await ai.chat({
    prompt: [
      `Foreslå ÉN kort, konkret dansk headline til det næste social media-opslag for brandet "${brand.name}".`,
      brand.companyContext ? `Brand-kontekst: ${brand.companyContext}` : "",
      brand.brandVoice ? `Tone: ${brand.brandVoice}` : "",
      usedHeadlines.length
        ? `Disse vinkler er allerede brugt — find en ANDEN: ${usedHeadlines.join(" · ")}`
        : "",
      "Svar KUN med selve headline-teksten — ingen anførselstegn, ingen forklaring.",
    ]
      .filter(Boolean)
      .join("\n"),
    tier: "cheap",
  });
  return text.trim().replace(/^["“]|["”]$/g, "");
}

type Brand = typeof tables.brandProfiles.$inferSelect;
type Activity = typeof tables.activities.$inferSelect;

// F013.2: produktions-vindue — aktivitetens stories genereres default 14 dage
// før periodStart. Serier (faste buffer-posts) håndteres af fillBrand.
const PRODUCTION_WINDOW_DAYS = 14;

function activityWindowOpen(a: Activity, now: Date): boolean {
  if (a.generatePolicy !== "auto") return false;
  if (a.type === "serie") return false; // serie = fast buffer, ikke produktions-ordre
  const windowStart = addDays(a.periodStart, -PRODUCTION_WINDOW_DAYS);
  return now >= windowStart && now <= a.periodEnd;
}

// headline på-tema for en aktivitet (tone-instruksen styrer vinklen)
async function headlineForActivity(brand: Brand, activity: Activity): Promise<string> {
  const { text } = await ai.chat({
    prompt: [
      `Foreslå ÉN kort, konkret dansk headline til et social media-opslag for brandet "${brand.name}".`,
      `Det er del af aktiviteten "${activity.title}" (${activity.type}).`,
      activity.toneInstruks ? `BINDENDE tone-instruks (vinder over alt): """${activity.toneInstruks}"""` : "",
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
 * F013.2: genererer aktivitetens manglende stories (cadencePerBrand pr. brand),
 * dateret i perioden, med tone-instruksen verbatim i prompten + activityId-
 * sporbarhed. Idempotent: count-baseret pr. brand. Returnerer antal skabt.
 */
async function fillActivity(activity: Activity, brands: Brand[], now: Date): Promise<number> {
  const targetBrands =
    activity.brandIds && activity.brandIds.length
      ? brands.filter((b) => activity.brandIds!.includes(b.id))
      : brands;
  const existing = await db
    .select()
    .from(tables.posts)
    .where(eq(tables.posts.activityId, activity.id));
  const periodMs = activity.periodEnd.getTime() - activity.periodStart.getTime();
  let made = 0;

  for (const brand of targetBrands) {
    const have = existing.filter((p) => p.brandId === brand.id).length;
    for (let i = have; i < activity.cadencePerBrand; i++) {
      const frac = (i + 0.5) / activity.cadencePerBrand;
      let scheduledDate = new Date(activity.periodStart.getTime() + periodMs * frac);
      if (scheduledDate < now) scheduledDate = addDays(now, GENERATION_LEAD_DAYS);
      try {
        const headline = await headlineForActivity(brand, activity);
        const { content } = await generatePostTexts({
          headline,
          companyContext: brand.companyContext ?? undefined,
          brandVoice: brand.brandVoice ?? undefined,
          platforms: activity.channels ?? brand.platforms ?? undefined,
          toneInstruks: activity.toneInstruks ?? undefined,
        });
        const [post] = await db
          .insert(tables.posts)
          .values({
            brandId: brand.id,
            headline,
            activityId: activity.id,
            linkedinText: content.linkedin?.text,
            instagramText: content.instagram?.text,
            facebookText: content.facebook?.text,
            hashtags: Object.fromEntries(
              Object.entries(content).map(([p, v]) => [p, v.hashtags]),
            ),
            scheduledDate,
          })
          .returning();
        try {
          if (!imageAvailable()) throw new Error("billed-lag ikke konfigureret");
          const { mediaId } = await generateStoryImage(brand, headline);
          await db
            .update(tables.posts)
            .set({ mediaId, mediaType: "ai-generated", imagePending: false })
            .where(eq(tables.posts.id, post.id));
        } catch {
          await db
            .update(tables.posts)
            .set({ imagePending: true })
            .where(eq(tables.posts.id, post.id));
        }
        made++;
        console.log(`[årshjul] ${activity.title} · ${brand.name}: +"${headline}"`);
      } catch (err) {
        console.warn(
          `[årshjul] ${activity.title} · ${brand.name}: generering fejlede — ${err instanceof Error ? err.message : err}`,
        );
        break;
      }
    }
  }
  return made;
}

// F012.3: headline afledt af Christians idé (idéen er råstoffet, ikke AI'ens
// egen opfindelse). Selve idé-teksten går desuden verbatim med i tekst-prompten.
async function headlineFromIdea(brand: Brand, ideaText: string): Promise<string> {
  const { text } = await ai.chat({
    prompt: [
      `Christians idé til et opslag for brandet "${brand.name}" (ordret): """${ideaText}"""`,
      brand.brandVoice ? `Tone: ${brand.brandVoice}` : "",
      "Foreslå ÉN kort, konkret dansk headline der bygger på PRÆCIS den idé.",
      "Svar KUN med selve headline-teksten — ingen anførselstegn, ingen forklaring.",
    ]
      .filter(Boolean)
      .join("\n"),
    tier: "cheap",
  });
  return text.trim().replace(/^["“]|["”]$/g, "");
}

// Fylder ét brands pipeline op til TARGET_BUFFER. Sekventiel inden for
// brandet (dato-markøren lægger +interval i forlængelse — ingen kollision).
async function fillBrand(
  brand: Brand,
  now: Date,
  pauseRanges: Array<{ start: Date; end: Date }> = [],
): Promise<void> {
  const brandPosts = await db
    .select()
    .from(tables.posts)
    .where(eq(tables.posts.brandId, brand.id));

  const future = brandPosts.filter(
    (p) => p.status !== "posted" && p.scheduledDate && p.scheduledDate > now,
  );
  const missing = TARGET_BUFFER - future.length;
  if (missing <= 0) return;

  const knownTimes = [
    ...future.map((p) => p.scheduledDate!.getTime()),
    ...brandPosts.filter((p) => p.postedAt).map((p) => p.postedAt!.getTime()),
  ];
  let cursor = knownTimes.length ? new Date(Math.max(...knownTimes)) : null;

  const usedHeadlines = brandPosts.slice(-8).map((p) => p.headline);
  const generated: string[] = [];

  // F012.3: Christians idéer først — ældste ubrugte idé for brandet er
  // råstoffet; kun når biblioteket er tomt opfinder AI'en selv en headline.
  const unusedIdeas = await db
    .select()
    .from(tables.ideas)
    .where(
      and(
        eq(tables.ideas.brandId, brand.id),
        isNull(tables.ideas.usedByPostId),
        ne(tables.ideas.status, "archived"),
      ),
    )
    .orderBy(asc(tables.ideas.createdAt));

  for (let i = 0; i < missing; i++) {
    try {
      const idea = unusedIdeas.shift();
      const headline = idea
        ? await headlineFromIdea(brand, idea.rawText)
        : await suggestHeadline(brand, [...usedHeadlines, ...generated]);
      const { content } = await generatePostTexts({
        headline,
        ideaText: idea?.rawText,
        companyContext: brand.companyContext ?? undefined,
        brandVoice: brand.brandVoice ?? undefined,
        platforms: brand.platforms ?? undefined,
      });
      let scheduledDate = cursor
        ? addDays(cursor, brand.postingIntervalDays)
        : addDays(now, GENERATION_LEAD_DAYS);
      // F013.2: pause faste serier i kampagne-perioder — spring datoen forbi
      // kampagnens slut, så du ikke poster dobbelt (kampagne-stories dækker ugen)
      for (let guard = 0; guard < 12; guard++) {
        const hit = pauseRanges.find((r) => scheduledDate >= r.start && scheduledDate <= r.end);
        if (!hit) break;
        scheduledDate = addDays(hit.end, brand.postingIntervalDays);
      }
      cursor = scheduledDate;
      const [post] = await db
        .insert(tables.posts)
        .values({
          brandId: brand.id,
          headline,
          ideaId: idea?.id,
          linkedinText: content.linkedin?.text,
          instagramText: content.instagram?.text,
          facebookText: content.facebook?.text,
          hashtags: Object.fromEntries(
            Object.entries(content).map(([p, v]) => [p, v.hashtags]),
          ),
          scheduledDate,
        })
        .returning();
      if (idea) {
        await db
          .update(tables.ideas)
          .set({ status: "used", usedByPostId: post.id })
          .where(eq(tables.ideas.id, idea.id));
      }
      // F012.4: on-brand billede på HVER story — fejl vælter ALDRIG storyen
      try {
        if (!imageAvailable()) throw new Error("billed-lag ikke konfigureret");
        const { mediaId, costUsd } = await generateStoryImage(brand, headline);
        await db
          .update(tables.posts)
          .set({ mediaId, mediaType: "ai-generated", imagePending: false })
          .where(eq(tables.posts.id, post.id));
        console.log(`[image] ${brand.name}: billede klar ($${costUsd ?? "?"})`);
      } catch (err) {
        await db
          .update(tables.posts)
          .set({ imagePending: true })
          .where(eq(tables.posts.id, post.id));
        console.warn(
          `[image] ${brand.name}: billede fejlede (storyen lever, regenerér fra UI) — ${err instanceof Error ? err.message : err}`,
        );
      }
      generated.push(headline);
      console.log(
        `[pipeline] ${brand.name}: +"${headline}"${idea ? " (fra idé)" : ""} → ${scheduledDate.toISOString().slice(0, 10)} (${future.length + generated.length}/${TARGET_BUFFER})`,
      );
    } catch (err) {
      // Ship-dark: én fejl (fx manglende AI-nøgle) vælter ikke resten —
      // og samme fejl rammer typisk alle genereringer, så spar kaldene.
      console.warn(
        `[pipeline] ${brand.name}: generering fejlede — ${err instanceof Error ? err.message : err}`,
      );
      break;
    }
  }

  // Én Discord-besked per brand per opfyldning — aldrig 5 på stribe
  if (generated.length === 1) {
    await notifyDraftReady({ brandId: brand.id, brandName: brand.name, headline: generated[0] });
  } else if (generated.length > 1) {
    await notifyDraftReady({
      brandId: brand.id,
      brandName: brand.name,
      headline: `${generated.length} nye udkast klar til gennemsyn`,
    });
  }
}

// Lås: to ticks må aldrig fylde oveni hinanden (count-tjekket er ellers
// race-udsat). Modul-level er nok — én Bun-proces, én pipeline.
let fillRunning = false;

/**
 * Daglig tick fra cronjobs.webhouse.net (via @broberg/cron-registrering).
 * Svarer STRAKS (cron-kaldere venter ikke på minutters AI-generering) og
 * fylder pipelinen i baggrunden: ≥TARGET_BUFFER fremtidige stories per brand
 * (count-baseret ⇒ idempotent), brands parallelt, sekventielt inden for
 * brandet. "Tid til at poste" sendes synkront (hurtigt).
 */
export const cronHookRoute = new Hono().post("/tick", async (c) => {
  if (env.CRON_HOOK_SECRET && c.req.header("x-cron-key") !== env.CRON_HOOK_SECRET) {
    return c.json({ error: "Ugyldig cron-nøgle" }, 401);
  }

  const now = new Date();
  const brands = await db
    .select()
    .from(tables.brandProfiles)
    .where(eq(tables.brandProfiles.status, "active"));
  const posts = await db.select().from(tables.posts);
  // F013.2: årshjul-aktiviteter — produktions-vinduer + kampagne-pause-perioder
  const activities = await db.select().from(tables.activities);
  const openActivities = activities.filter((a) => activityWindowOpen(a, now));
  const pauseRangesFor = (brand: Brand) =>
    activities
      .filter(
        (a) =>
          a.type === "kampagne" &&
          (!a.brandIds?.length || a.brandIds.includes(brand.id)),
      )
      .map((a) => ({ start: a.periodStart, end: a.periodEnd }));

  // "Tid til at poste i dag" for godkendte posts med scheduledDate i dag
  const timeToPost: Array<{ brand: string; headline: string }> = [];
  for (const brand of brands) {
    for (const p of posts) {
      if (
        p.brandId === brand.id &&
        p.status === "ready" &&
        p.scheduledDate &&
        sameDay(p.scheduledDate, now)
      ) {
        await notifyTimeToPost({ brandId: brand.id, brandName: brand.name, headline: p.headline });
        timeToPost.push({ brand: brand.name, headline: p.headline });
      }
    }
  }

  const plan = brands.map((b) => ({
    brand: b.name,
    missing: Math.max(
      0,
      TARGET_BUFFER -
        posts.filter(
          (p) =>
            p.brandId === b.id &&
            p.status !== "posted" &&
            p.scheduledDate &&
            p.scheduledDate > now,
        ).length,
    ),
  }));

  let fill: "started" | "already-running" | "not-needed" = "not-needed";
  const needsWork = plan.some((p) => p.missing > 0) || openActivities.length > 0;
  if (needsWork) {
    if (fillRunning) {
      fill = "already-running";
    } else {
      fillRunning = true;
      fill = "started";
      // Bevidst IKKE awaited: svaret skal ud nu; arbejdet kører videre.
      // Rækkefølge: årshjul-aktiviteter FØRST (så pause-perioderne findes),
      // derefter buffer-opfyldning der springer kampagne-uger over.
      void (async () => {
        for (const a of openActivities) await fillActivity(a, brands, now);
        await Promise.all(brands.map((b) => fillBrand(b, now, pauseRangesFor(b))));
      })()
        .catch((err) => console.warn(`[pipeline] fill fejlede: ${err}`))
        .finally(() => {
          fillRunning = false;
          console.log("[pipeline] opfyldning færdig");
        });
    }
  }

  return c.json({
    ok: true,
    at: now.toISOString(),
    fill,
    plan,
    timeToPost,
    activities: { open: openActivities.length, total: activities.length },
  });
});

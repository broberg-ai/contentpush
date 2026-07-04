import { Hono } from "hono";
import { and, asc, eq, gte, lt } from "drizzle-orm";
import { db, tables } from "../db";
import { media, variantKey } from "../lib/media";

const DAY_MS = 24 * 60 * 60 * 1000;

// Dato-nøgle i dansk tid (sv-SE-locale formaterer YYYY-MM-DD) — afgør hvilken
// kalenderdag et opslag hører til, uafhængigt af UTC-forskydning.
function dateKey(d: Date): string {
  return d.toLocaleDateString("sv-SE", { timeZone: "Europe/Copenhagen" });
}

// F012.2: pipeline-status per brand — hvor mange fremtidige stories ligger klar.
const PIPELINE_TARGET = 5;

// F012.1: månedens posts grupperet pr. dato, med brandName + thumb-URL.
export const calendarRoute = new Hono()
  // F012.4: "Næste 5" — de nærmeste kommende stories på tværs af brands
  .get("/next", async (c) => {
    const now = new Date();
    const rows = await db
      .select({
        post: tables.posts,
        brandName: tables.brandProfiles.name,
        mediaUrl: tables.mediaLibrary.url,
      })
      .from(tables.posts)
      .leftJoin(
        tables.brandProfiles,
        eq(tables.posts.brandId, tables.brandProfiles.id),
      )
      .leftJoin(tables.mediaLibrary, eq(tables.posts.mediaId, tables.mediaLibrary.id))
      .where(gte(tables.posts.scheduledDate, now))
      .orderBy(asc(tables.posts.scheduledDate));
    const upcoming = rows.filter(({ post }) => post.status !== "posted").slice(0, 5);
    const next = await Promise.all(
      upcoming.map(async ({ post, brandName, mediaUrl }) => ({
        ...post,
        brandName,
        thumbUrl:
          mediaUrl && media
            ? await media.signedUrl(variantKey(mediaUrl, "thumb", "image/webp"))
            : null,
      })),
    );
    return c.json({ next });
  })
  .get("/pipeline", async (c) => {
    const now = new Date();
    const brands = await db.select().from(tables.brandProfiles);
    const posts = await db.select().from(tables.posts);
    const pipeline = brands.map((b) => ({
      brandId: b.id,
      name: b.name,
      futureCount: posts.filter(
        (p) =>
          p.brandId === b.id &&
          p.status !== "posted" &&
          p.scheduledDate &&
          p.scheduledDate > now,
      ).length,
      target: PIPELINE_TARGET,
    }));
    return c.json({ pipeline });
  })
  .get("/", async (c) => {
  const month = c.req.query("month") ?? dateKey(new Date()).slice(0, 7);
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    return c.json({ error: "month skal være YYYY-MM" }, 400);
  }
  const [y, m] = month.split("-").map(Number);
  // ±1 dags polstring om måneden; CPH-datonøglen afgør endeligt medlemskab
  const rangeStart = new Date(Date.UTC(y, m - 1, 1) - DAY_MS);
  const rangeEnd = new Date(Date.UTC(y, m, 1) + DAY_MS);

  const rows = await db
    .select({
      post: tables.posts,
      brandName: tables.brandProfiles.name,
      mediaUrl: tables.mediaLibrary.url,
    })
    .from(tables.posts)
    .leftJoin(
      tables.brandProfiles,
      eq(tables.posts.brandId, tables.brandProfiles.id),
    )
    .leftJoin(tables.mediaLibrary, eq(tables.posts.mediaId, tables.mediaLibrary.id))
    .where(
      and(
        gte(tables.posts.scheduledDate, rangeStart),
        lt(tables.posts.scheduledDate, rangeEnd),
      ),
    )
    .orderBy(asc(tables.posts.scheduledDate));

  const days: Record<string, unknown[]> = {};
  for (const { post, brandName, mediaUrl } of rows) {
    if (!post.scheduledDate) continue;
    const key = dateKey(post.scheduledDate);
    if (!key.startsWith(month)) continue;
    const thumbUrl =
      mediaUrl && media
        ? await media.signedUrl(variantKey(mediaUrl, "thumb", "image/webp"))
        : null;
    (days[key] ??= []).push({ ...post, brandName, thumbUrl });
  }

  return c.json({ month, days });
});

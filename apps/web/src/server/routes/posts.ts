import { Hono } from "hono";
import { desc, eq } from "drizzle-orm";
import { db, tables } from "../db";
import { generatePostTexts } from "./generate";

const DAY_MS = 24 * 60 * 60 * 1000;

export const postsRoute = new Hono()
  .get("/", async (c) => {
    const rows = await db
      .select({ post: tables.posts, brandName: tables.brandProfiles.name })
      .from(tables.posts)
      .leftJoin(
        tables.brandProfiles,
        eq(tables.posts.brandId, tables.brandProfiles.id),
      )
      .orderBy(desc(tables.posts.createdAt));
    return c.json({
      posts: rows.map(({ post, brandName }) => ({ ...post, brandName })),
    });
  })
  // F005.2: godkend (draft → ready)
  .post("/:id/approve", async (c) => {
    const [post] = await db
      .update(tables.posts)
      .set({ status: "ready" })
      .where(eq(tables.posts.id, c.req.param("id")))
      .returning();
    if (!post) return c.json({ error: "Ukendt post" }, 404);
    return c.json({ post });
  })
  // F005.2: regenerér teksterne (samme headline + brandets kontekst; status uændret)
  .post("/:id/regenerate", async (c) => {
    const [post] = await db
      .select()
      .from(tables.posts)
      .where(eq(tables.posts.id, c.req.param("id")));
    if (!post) return c.json({ error: "Ukendt post" }, 404);

    const [brand] = await db
      .select()
      .from(tables.brandProfiles)
      .where(eq(tables.brandProfiles.id, post.brandId));

    try {
      const { content } = await generatePostTexts({
        headline: post.headline,
        companyContext: brand?.companyContext ?? undefined,
        brandVoice: brand?.brandVoice ?? undefined,
        platforms: brand?.platforms ?? undefined,
      });
      const [updated] = await db
        .update(tables.posts)
        .set({
          linkedinText: content.linkedin?.text,
          instagramText: content.instagram?.text,
          facebookText: content.facebook?.text,
          hashtags: Object.fromEntries(
            Object.entries(content).map(([p, v]) => [p, v.hashtags]),
          ),
        })
        .where(eq(tables.posts.id, post.id))
        .returning();
      return c.json({ post: updated });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return c.json({ error: `Regenerering fejlede: ${message}` }, 503);
    }
  })
  .post("/:id/mark-posted", async (c) => {
    const id = c.req.param("id");
    const [post] = await db
      .select()
      .from(tables.posts)
      .where(eq(tables.posts.id, id));
    if (!post) return c.json({ error: "Ukendt post" }, 404);

    const [brand] = await db
      .select()
      .from(tables.brandProfiles)
      .where(eq(tables.brandProfiles.id, post.brandId));

    const postedAt = new Date();
    const [updated] = await db
      .update(tables.posts)
      .set({ status: "posted", postedAt })
      .where(eq(tables.posts.id, id))
      .returning();

    // Næste post auto-planlægges +interval dage (brandets postingIntervalDays,
    // default 14). Cron-tick'en genererer udkastet LEAD dage før den dato.
    const nextScheduledDate = new Date(
      postedAt.getTime() + (brand?.postingIntervalDays ?? 14) * DAY_MS,
    );

    return c.json({ post: updated, nextScheduledDate });
  });

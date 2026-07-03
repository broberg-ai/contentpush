import { Hono } from "hono";
import { desc, eq } from "drizzle-orm";
import { db, tables } from "../db";

const DAY_MS = 24 * 60 * 60 * 1000;

// F004.2: mark-posted + liste. Øvrige review-actions (approve/regenerate/
// mark-ready) kommer i F005.2 sammen med dashboardet.
export const postsRoute = new Hono()
  .get("/", async (c) => {
    const posts = await db
      .select()
      .from(tables.posts)
      .orderBy(desc(tables.posts.createdAt));
    return c.json({ posts });
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

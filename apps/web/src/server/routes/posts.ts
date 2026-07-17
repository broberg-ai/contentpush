import { Hono } from "hono";
import { desc, eq } from "drizzle-orm";
import { db, tables } from "../db";
import { media, variantKey } from "../lib/media";
import { generateStoryImage } from "../lib/images";
import {
  renderPostTemplateVideo,
  renderPostAiVideo,
  hasTemplateVideo,
  suggestHeroVideos,
  postVideoUrls,
} from "../lib/videos";
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
  // F012.5: fuld detalje til sheet-visningen — brandName, idé-tekst (sporbarhed)
  // og signerede billed-URL'er i ét svar
  .get("/:id", async (c) => {
    const [row] = await db
      .select({
        post: tables.posts,
        brandName: tables.brandProfiles.name,
        mediaUrl: tables.mediaLibrary.url,
        ideaText: tables.ideas.rawText,
      })
      .from(tables.posts)
      .leftJoin(
        tables.brandProfiles,
        eq(tables.posts.brandId, tables.brandProfiles.id),
      )
      .leftJoin(tables.mediaLibrary, eq(tables.posts.mediaId, tables.mediaLibrary.id))
      .leftJoin(tables.ideas, eq(tables.posts.ideaId, tables.ideas.id))
      .where(eq(tables.posts.id, c.req.param("id")));
    if (!row) return c.json({ error: "Ukendt post" }, 404);
    const gridUrl =
      row.mediaUrl && media
        ? await media.signedUrl(variantKey(row.mediaUrl, "grid", "image/webp"))
        : null;
    // F014.2: signerede video-URL'er pr. format (null når opslaget ingen video har)
    const videoUrls = await postVideoUrls(row.post.id);
    return c.json({
      post: {
        ...row.post,
        brandName: row.brandName,
        ideaText: row.ideaText,
        gridUrl,
        videoUrls,
      },
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
  // F012.4: regenerér billedet — gammelt billede bevares i media_library
  .post("/:id/regenerate-image", async (c) => {
    const [post] = await db
      .select()
      .from(tables.posts)
      .where(eq(tables.posts.id, c.req.param("id")));
    if (!post) return c.json({ error: "Ukendt post" }, 404);
    const [brand] = await db
      .select()
      .from(tables.brandProfiles)
      .where(eq(tables.brandProfiles.id, post.brandId));
    if (!brand) return c.json({ error: "Ukendt brand" }, 404);
    try {
      const { mediaId } = await generateStoryImage(brand, post.headline);
      const [updated] = await db
        .update(tables.posts)
        .set({ mediaId, mediaType: "ai-generated", imagePending: false })
        .where(eq(tables.posts.id, post.id))
        .returning();
      const [item] = await db
        .select()
        .from(tables.mediaLibrary)
        .where(eq(tables.mediaLibrary.id, mediaId));
      const gridUrl =
        item && media
          ? await media.signedUrl(variantKey(item.url, "grid", "image/webp"))
          : null;
      return c.json({ post: { ...updated, gridUrl } });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return c.json({ error: `Billed-generering fejlede: ${message}` }, 503);
    }
  })
  // F014.3: foreslå-motoren — flag hero-opslag (lancering/mærkedag) som
  // "AI-video-værd". Idempotent scan; genererer intet (koster ikke penge).
  .post("/suggest-videos", async (c) => {
    const suggested = await suggestHeroVideos();
    return c.json({ suggested });
  })
  // F014.2: lav gratis skabelon-video (16:9 + 9:16) fra opslagets still.
  // Deterministisk ffmpeg-søm, $0, synkront (~5s/format). AI-vejen er F014.3.
  .post("/:id/video/template", async (c) => {
    const id = c.req.param("id");
    const [post] = await db
      .select()
      .from(tables.posts)
      .where(eq(tables.posts.id, id));
    if (!post) return c.json({ error: "Ukendt post" }, 404);
    if (!media) return c.json({ error: "Video-storage ikke konfigureret" }, 503);
    if (!post.mediaId)
      return c.json({ error: "Opslaget mangler et billede at animere" }, 400);

    const [brand] = await db
      .select()
      .from(tables.brandProfiles)
      .where(eq(tables.brandProfiles.id, post.brandId));

    try {
      await renderPostTemplateVideo(post, brand);
      const [updated] = await db
        .select()
        .from(tables.posts)
        .where(eq(tables.posts.id, id));
      const videoUrls = await postVideoUrls(id);
      return c.json({ post: updated, videoUrls });
    } catch (err) {
      await db
        .update(tables.posts)
        .set({ videoStatus: "failed" })
        .where(eq(tables.posts.id, id));
      const message = err instanceof Error ? err.message : String(err);
      return c.json({ error: `Video-generering fejlede: ${message}` }, 503);
    }
  })
  // F014.3: godkend forslaget → generér AI-klip (Kling via ai.animate, 16:9 +
  // 9:16). Synkront/parallelt (~1-2 min); tilstanden sættes 'rendering' først
  // så en samtidig visning ser fremgangen. Fejl → 'failed'.
  .post("/:id/video/approve", async (c) => {
    const id = c.req.param("id");
    const [post] = await db
      .select()
      .from(tables.posts)
      .where(eq(tables.posts.id, id));
    if (!post) return c.json({ error: "Ukendt post" }, 404);
    if (!media) return c.json({ error: "Video-storage ikke konfigureret" }, 503);
    if (!post.mediaId)
      return c.json({ error: "Opslaget mangler et billede at animere" }, 400);

    const [brand] = await db
      .select()
      .from(tables.brandProfiles)
      .where(eq(tables.brandProfiles.id, post.brandId));

    await db
      .update(tables.posts)
      .set({ videoStatus: "rendering" })
      .where(eq(tables.posts.id, id));

    try {
      const { costUsd } = await renderPostAiVideo(post, brand);
      const [updated] = await db
        .select()
        .from(tables.posts)
        .where(eq(tables.posts.id, id));
      const videoUrls = await postVideoUrls(id);
      return c.json({ post: updated, videoUrls, costUsd });
    } catch (err) {
      await db
        .update(tables.posts)
        .set({ videoStatus: "failed" })
        .where(eq(tables.posts.id, id));
      const message = err instanceof Error ? err.message : String(err);
      return c.json({ error: `AI-video fejlede: ${message}` }, 503);
    }
  })
  // F014.3: afvis forslaget → behold skabelon-videoen (ready hvis den findes,
  // ellers none). Intet AI-kald, ingen omkostning.
  .post("/:id/video/reject", async (c) => {
    const id = c.req.param("id");
    const [post] = await db
      .select()
      .from(tables.posts)
      .where(eq(tables.posts.id, id));
    if (!post) return c.json({ error: "Ukendt post" }, 404);

    const keepsTemplate = await hasTemplateVideo(id);
    const [updated] = await db
      .update(tables.posts)
      .set({ videoStatus: keepsTemplate ? "ready" : "none" })
      .where(eq(tables.posts.id, id))
      .returning();
    const videoUrls = await postVideoUrls(id);
    return c.json({ post: updated, videoUrls });
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

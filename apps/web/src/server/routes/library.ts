import { Hono } from "hono";
import { desc } from "drizzle-orm";
import { transformImage } from "@broberg/media-transform";
import { media, variantKey } from "../lib/media";
import { db, tables } from "../db";

// Stock-bibliotek (F003.1) + transform-ingest (F003.2).
// Alt uploadet normaliseres FØR lagring: HEIC→JPEG, EXIF-strip, responsive WebP.
export const libraryRoute = new Hono()
  .get("/", async (c) => {
    const items = await db
      .select()
      .from(tables.mediaLibrary)
      .orderBy(desc(tables.mediaLibrary.createdAt));

    const withUrls = await Promise.all(
      items.map(async (item) => ({
        ...item,
        thumbUrl: media
          ? await media.signedUrl(variantKey(item.url, "thumb", "image/webp"))
          : null,
        gridUrl: media
          ? await media.signedUrl(variantKey(item.url, "grid", "image/webp"))
          : null,
      })),
    );

    return c.json({ items: withUrls, storageConfigured: media !== null });
  })
  .post("/", async (c) => {
    if (!media) {
      // Ship-dark: ingen R2-creds endnu
      return c.json({ error: "Media-storage er ikke konfigureret (R2-creds mangler)" }, 503);
    }

    const form = await c.req.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File)) {
      return c.json({ error: "Multipart-felt 'file' mangler" }, 400);
    }
    const description = (form?.get("description") ?? "") as string;
    const tags = ((form?.get("tags") ?? "") as string)
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    const bytes = new Uint8Array(await file.arrayBuffer());

    // F003.2: normalisér på ingest — HEIC→JPEG, auto-orient, EXIF-strip, varianter
    const { variants } = await transformImage(bytes, {
      heicToJpeg: true,
      keepOriginal: true,
      variants: [
        { name: "thumb", maxEdge: 320, format: "webp", quality: 80 },
        { name: "grid", maxEdge: 800, format: "webp", quality: 80 },
        { name: "full", maxEdge: 1600, format: "webp", quality: 80 },
      ],
    });

    const baseKey = `library/${crypto.randomUUID()}`;
    for (const v of variants) {
      await media.upload(variantKey(baseKey, v.name, v.contentType), v.bytes, {
        contentType: v.contentType,
      });
    }

    const [item] = await db
      .insert(tables.mediaLibrary)
      .values({
        url: baseKey, // storage-reference (key-prefix); varianter under <baseKey>/<navn>
        type: "stock-image",
        tags,
        description: description || null,
      })
      .returning();

    return c.json({
      item,
      variants: variants.map((v) => ({
        name: v.name,
        width: v.width,
        height: v.height,
        contentType: v.contentType,
      })),
    });
  });

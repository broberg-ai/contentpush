import { Hono } from "hono";
import { eq } from "drizzle-orm";
import JSZip from "jszip";
import { db, tables } from "../db";
import { media, variantKey } from "../lib/media";

// F005.3: download-pakke — zip med linkedin.txt / instagram.txt / facebook.txt
// (tekst + hashtags) og media/ med det TRANSFORMEREDE asset (F003.2-varianten,
// aldrig originalen). Formatet er låst per plan §3.
const PLATFORM_FIELDS = [
  ["linkedin", "linkedinText"],
  ["instagram", "instagramText"],
  ["facebook", "facebookText"],
] as const;

export const packageRoute = new Hono().get("/:id/package", async (c) => {
  const [post] = await db
    .select()
    .from(tables.posts)
    .where(eq(tables.posts.id, c.req.param("id")));
  if (!post) return c.json({ error: "Ukendt post" }, 404);

  const zip = new JSZip();

  for (const [platform, field] of PLATFORM_FIELDS) {
    const text = post[field];
    if (!text) continue;
    const hashtags = post.hashtags?.[platform]?.join(" ") ?? "";
    zip.file(`${platform}.txt`, hashtags ? `${text}\n\n${hashtags}\n` : `${text}\n`);
  }

  if (post.mediaId && media) {
    const [item] = await db
      .select()
      .from(tables.mediaLibrary)
      .where(eq(tables.mediaLibrary.id, post.mediaId));
    if (item) {
      // full-varianten = det transformerede, posting-klare asset
      const url = await media.signedUrl(variantKey(item.url, "full", "image/webp"));
      const res = await fetch(url);
      if (res.ok) {
        zip.file("media/full.webp", await res.arrayBuffer());
      }
    }
  }

  const buffer = await zip.generateAsync({ type: "arraybuffer" });
  const slug = post.headline
    .toLowerCase()
    .replace(/[^a-z0-9æøå]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);

  return c.body(buffer, 200, {
    "Content-Type": "application/zip",
    "Content-Disposition": `attachment; filename="contentpush-${slug}.zip"`,
  });
});

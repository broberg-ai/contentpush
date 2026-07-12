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

  // F009.2: pakken indeholder PRÆCIS brandets platforme — ikke alle tre.
  // Er brand.platforms sat, begrænser vi til dem; ellers (null) tages alle
  // platforme der har tekst (bagudkompatibelt for profiler uden platform-valg).
  const [brand] = await db
    .select()
    .from(tables.brandProfiles)
    .where(eq(tables.brandProfiles.id, post.brandId));
  const brandPlatforms = brand?.platforms ?? null;

  const zip = new JSZip();

  for (const [platform, field] of PLATFORM_FIELDS) {
    if (brandPlatforms && !brandPlatforms.includes(platform)) continue;
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
  // Content-Disposition SKAL være ASCII — translitterér æøå og strip øvrige
  // ikke-ASCII (danske overskrifter gav ellers 500 på headeren).
  const slug =
    post.headline
      .toLowerCase()
      .replace(/æ/g, "ae")
      .replace(/ø/g, "oe")
      .replace(/å/g, "aa")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "opslag";

  return c.body(buffer, 200, {
    "Content-Type": "application/zip",
    "Content-Disposition": `attachment; filename="contentpush-${slug}.zip"`,
  });
});

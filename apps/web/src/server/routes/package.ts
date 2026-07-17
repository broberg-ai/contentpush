import { Hono } from "hono";
import { eq } from "drizzle-orm";
import JSZip from "jszip";
import { db, tables } from "../db";
import { media, variantKey } from "../lib/media";
import { postVideoUrls } from "../lib/videos";

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
      // full-varianten = det transformerede, posting-klare asset (altid med
      // som fallback-billede, også når opslaget har video)
      const url = await media.signedUrl(variantKey(item.url, "full", "image/webp"));
      const res = await fetch(url);
      if (res.ok) {
        zip.file("media/full.webp", await res.arrayBuffer());
      }
    }
  }

  // F014.2: har opslaget video, ryk begge formater med i pakken (mp4).
  if (post.mediaType === "video" && media) {
    const videoUrls = await postVideoUrls(post.id);
    for (const [aspect, name] of [
      ["16:9", "video-16x9.mp4"],
      ["9:16", "video-9x16.mp4"],
    ] as const) {
      const url = videoUrls[aspect];
      if (!url) continue;
      const res = await fetch(url);
      if (res.ok) zip.file(`media/${name}`, await res.arrayBuffer());
    }
  }

  const buffer = await zip.generateAsync({ type: "arraybuffer" });

  // Content-Disposition SKAL være ASCII (Bun afviser non-ASCII headere → 500).
  // RFC 5987: ASCII `filename=`-fallback (æøå→ae/oe/aa) + `filename*=UTF-8''…`
  // der bevarer det rigtige danske navn til klienter der forstår det.
  const base = post.headline
    .toLowerCase()
    .replace(/[^a-z0-9æøå]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  const niceName = `contentpush-${base || "opslag"}.zip`;
  const asciiName = niceName
    .replace(/æ/g, "ae")
    .replace(/ø/g, "oe")
    .replace(/å/g, "aa");

  return c.body(buffer, 200, {
    "Content-Type": "application/zip",
    "Content-Disposition": `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(niceName)}`,
  });
});

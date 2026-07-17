import { eq } from "drizzle-orm";
import sharp from "sharp";
import { renderTemplateAnimation, type Aspect } from "./videoRender";
import { media, variantKey } from "./media";
import { ai } from "./ai";
import { db, tables } from "../db";

// F014.2: orkestrering af video på et opslag — render (skabelon-søm) → R2 →
// media_library + post_videos → opslagets video-tilstand. AI-vejen (F014.3)
// genbruger de samme lagrings-helpers, kun renderen skifter.

const ASPECTS: Aspect[] = ["16:9", "9:16"];
const KEY_BY_ASPECT: Record<Aspect, string> = { "16:9": "16x9", "9:16": "9x16" };

type PostRow = typeof tables.posts.$inferSelect;
type BrandRow = typeof tables.brandProfiles.$inferSelect;

/** Henter still-bytes for et opslag (full-varianten fra R2) til at animere. */
async function fetchStillBytes(mediaBaseKey: string): Promise<Uint8Array> {
  if (!media) throw new Error("Media-storage ikke konfigureret (ship-dark)");
  const url = await media.signedUrl(variantKey(mediaBaseKey, "full", "image/webp"));
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Still-download fejlede: HTTP ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}

/** Lagrer én mp4 i R2 + media_library + post_videos for et opslag/format. */
async function storeAspectVideo(
  postId: string,
  aspect: Aspect,
  bytes: Uint8Array,
  headline: string,
  technique: "template" | "ai",
): Promise<void> {
  if (!media) throw new Error("Media-storage ikke konfigureret (ship-dark)");
  const key = `video/${crypto.randomUUID()}/${KEY_BY_ASPECT[aspect]}.mp4`;
  await media.upload(key, bytes, { contentType: "video/mp4" });
  const [item] = await db
    .insert(tables.mediaLibrary)
    // video-rækker gemmer den FULDE object-nøgle (inkl. .mp4), ikke et præfiks
    .values({ url: key, type: "video", description: headline })
    .returning();
  await db
    .insert(tables.postVideos)
    .values({ postId, aspect, mediaId: item.id, technique });
}

/**
 * Renders skabelon-video (16:9 + 9:16) fra opslagets still, lagrer begge, og
 * sætter opslagets video-tilstand til ready. Deterministisk, $0. Kaster ved
 * manglende still/storage — kalderen svarer med passende status.
 */
export async function renderPostTemplateVideo(
  post: PostRow,
  brand: BrandRow | undefined,
): Promise<void> {
  if (!media) throw new Error("Media-storage ikke konfigureret (ship-dark)");
  if (!post.mediaId) throw new Error("Opslaget mangler et billede at animere");

  const [still] = await db
    .select()
    .from(tables.mediaLibrary)
    .where(eq(tables.mediaLibrary.id, post.mediaId));
  if (!still) throw new Error("Opslagets billede findes ikke i biblioteket");

  const imageBytes = await fetchStillBytes(still.url);

  // Idempotent regenerering: ryd forrige video-rækker for opslaget først
  // (de gamle media_library-rækker/R2-objekter bevares, som ved billeder).
  await db.delete(tables.postVideos).where(eq(tables.postVideos.postId, post.id));

  for (const aspect of ASPECTS) {
    const { bytes } = await renderTemplateAnimation({
      imageBytes,
      headline: post.headline,
      subtitle: brand?.name,
      aspect,
    });
    await storeAspectVideo(post.id, aspect, bytes, post.headline, "template");
  }

  await db
    .update(tables.posts)
    .set({ mediaType: "video", videoStatus: "ready", videoTechnique: "template" })
    .where(eq(tables.posts.id, post.id));
}

// F014.3 — AI-opgradering (hero-opslag). Kling i2v via ai.animate's blessede
// fal-rute (FAL_KEY-only; DEFAULT_ANIMATE_SPEC er Gemini/Veo som vi ikke har
// nøgle til). Kling arver aspekten fra input-billedet → vi beskærer stillet til
// hvert format før animate. ~$0.35/klip; de to klip køres PARALLELT så
// wall-clock holder sig under serverens idleTimeout.
const ANIMATE_OVERRIDE = {
  provider: "fal",
  model: "fal-ai/kling-video/v2.5-turbo/pro/image-to-video",
} as const;

const ASPECT_DIMS: Record<Aspect, { w: number; h: number }> = {
  "16:9": { w: 1280, h: 720 },
  "9:16": { w: 720, h: 1280 },
};

/** Beskærer stillet (cover) til målformatet så Kling arver den rigtige aspekt. */
async function cropStill(
  imageBytes: Uint8Array,
  aspect: Aspect,
): Promise<Uint8Array<ArrayBuffer>> {
  const { w, h } = ASPECT_DIMS[aspect];
  const out = await sharp(imageBytes)
    .resize(w, h, { fit: "cover" })
    .jpeg({ quality: 90 })
    .toBuffer();
  // Kopiér til en frisk ArrayBuffer-backet array (ai.animate kræver den type)
  const bytes = new Uint8Array(out.byteLength);
  bytes.set(out);
  return bytes;
}

function buildMotionPrompt(brand: BrandRow | undefined, headline: string): string {
  return [
    `Subtle cinematic motion for a social post about: ${headline}.`,
    brand?.brandVoice ? `Mood: ${brand.brandVoice}.` : "",
    "Gentle camera push-in, soft light shift, atmospheric. Keep the composition.",
    "No new text, no letters, no logos, no people's faces appearing.",
  ]
    .filter(Boolean)
    .join(" ");
}

/**
 * Genererer AI-klip (16:9 + 9:16) for et opslag via ai.animate (fal/Kling),
 * lagrer begge (erstatter evt. skabelon-videoer), og sætter tilstanden ready
 * med technique='ai'. Kaster ved fejl — kalderen sætter 'failed'. ~$0.70.
 */
export async function renderPostAiVideo(
  post: PostRow,
  brand: BrandRow | undefined,
): Promise<{ costUsd: number }> {
  if (!media) throw new Error("Media-storage ikke konfigureret (ship-dark)");
  if (!post.mediaId) throw new Error("Opslaget mangler et billede at animere");

  const [still] = await db
    .select()
    .from(tables.mediaLibrary)
    .where(eq(tables.mediaLibrary.id, post.mediaId));
  if (!still) throw new Error("Opslagets billede findes ikke i biblioteket");

  const imageBytes = await fetchStillBytes(still.url);
  const prompt = buildMotionPrompt(brand, post.headline);

  // De to formater genereres parallelt (wall-clock ≈ ét klip, ikke summen)
  const clips = await Promise.all(
    ASPECTS.map(async (aspect) => {
      const cropped = await cropStill(imageBytes, aspect);
      const { url, bytes, usage } = await ai.animate({
        image: cropped,
        prompt,
        durationSec: 5,
        override: ANIMATE_OVERRIDE,
        purpose: "contentpush hero-video",
      });
      let vbytes = bytes;
      if (!vbytes) {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`AI-video download fejlede: HTTP ${res.status}`);
        vbytes = new Uint8Array(await res.arrayBuffer());
      }
      return { aspect, bytes: vbytes, costUsd: usage?.costUsd ?? 0 };
    }),
  );

  // Erstat evt. skabelon-videoer med AI-klippene
  await db.delete(tables.postVideos).where(eq(tables.postVideos.postId, post.id));
  for (const clip of clips) {
    await storeAspectVideo(post.id, clip.aspect, clip.bytes, post.headline, "ai");
  }

  await db
    .update(tables.posts)
    .set({ mediaType: "video", videoStatus: "ready", videoTechnique: "ai" })
    .where(eq(tables.posts.id, post.id));

  return { costUsd: clips.reduce((sum, c) => sum + c.costUsd, 0) };
}

/** Har opslaget en klar skabelon-video liggende? (til afvis → behold skabelon) */
export async function hasTemplateVideo(postId: string): Promise<boolean> {
  const rows = await db
    .select({ technique: tables.postVideos.technique })
    .from(tables.postVideos)
    .where(eq(tables.postVideos.postId, postId));
  return rows.some((r) => r.technique === "template");
}

// F014.3 — foreslå-motoren: ren, forklarlig regel (ingen LLM). Et opslag er
// "AI-video-værd" hvis dets årshjuls-aktivitet er en lancering eller mærkedag.
export function shouldSuggestVideo(activityType: string | null | undefined): boolean {
  return activityType === "lancering" || activityType === "maerkedag";
}

/**
 * Idempotent gennemløb: flag opslag hvis aktivitet er lancering/mærkedag som
 * videoStatus='suggested' — men kun dem der står 'none' (rører ikke ready/
 * approved/rendering). Returnerer antal nyligt foreslåede.
 */
export async function suggestHeroVideos(): Promise<number> {
  const rows = await db
    .select({ id: tables.posts.id, type: tables.activities.type })
    .from(tables.posts)
    .innerJoin(
      tables.activities,
      eq(tables.posts.activityId, tables.activities.id),
    )
    .where(eq(tables.posts.videoStatus, "none"));

  let count = 0;
  for (const r of rows) {
    if (!shouldSuggestVideo(r.type)) continue;
    await db
      .update(tables.posts)
      .set({ videoStatus: "suggested" })
      .where(eq(tables.posts.id, r.id));
    count++;
  }
  return count;
}

/** Signerede video-URL'er pr. aspekt for et opslag (til preview + pakke). */
export async function postVideoUrls(
  postId: string,
): Promise<Record<Aspect, string | null>> {
  const result: Record<Aspect, string | null> = { "16:9": null, "9:16": null };
  if (!media) return result;
  const rows = await db
    .select({ aspect: tables.postVideos.aspect, url: tables.mediaLibrary.url })
    .from(tables.postVideos)
    .leftJoin(
      tables.mediaLibrary,
      eq(tables.postVideos.mediaId, tables.mediaLibrary.id),
    )
    .where(eq(tables.postVideos.postId, postId));
  for (const r of rows) {
    if (r.url) result[r.aspect] = await media.signedUrl(r.url);
  }
  return result;
}

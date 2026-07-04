import { transformImage } from "@broberg/media-transform";
import { ai } from "./ai";
import { media, variantKey } from "./media";
import { db, tables } from "../db";
import { env } from "../env";

// F012.4: on-brand billede per story. KUN ai.image via @broberg/ai-sdk —
// aldrig rå provider. Brand-billeder kører default-ruten (fal/FLUX): prompten
// indeholder INGEN persondata og forbyder ansigter ⇒ GDPR-ok uden EU-krav.
// BFL (EU) er portræt-vejen (reference/finetune, F009.3). Recraft-opgradering
// sker centralt i ai-sdk (F033) uden ændringer her.

type Brand = typeof tables.brandProfiles.$inferSelect;

export function imageAvailable(): boolean {
  return Boolean(env.FAL_KEY) && media !== null;
}

function buildImagePrompt(brand: Brand, headline: string): string {
  return [
    `Editorial social media image for the brand "${brand.name}".`,
    `Subject: ${headline}.`,
    brand.companyContext ? `Brand context: ${brand.companyContext}` : "",
    brand.brandVoice ? `Mood/tone: ${brand.brandVoice}` : "",
    "Style: warm, calm, premium editorial photography/illustration. Earthy palette.",
    "Strictly NO text, NO letters, NO logos, NO watermarks in the image. No people's faces.",
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Genererer et on-brand billede for en story, lagrer varianter i R2 (EU)
 * og returnerer media_library-id'et. Kaster ved fejl — kalderen afgør om
 * det er fatalt (cron: aldrig; API: 503).
 */
export async function generateStoryImage(
  brand: Brand,
  headline: string,
): Promise<{ mediaId: string; costUsd?: number }> {
  if (!env.FAL_KEY) throw new Error("FAL_KEY ikke sat (ship-dark)");
  if (!media) throw new Error("Media-storage ikke konfigureret (ship-dark)");

  const prompt = buildImagePrompt(brand, headline);
  console.log(`[image] ${brand.name}: prompt = ${prompt.replace(/\n/g, " · ")}`);

  // F003.3: er der trænet en brand-stil-LoRA, styrer den udtrykket
  const { url, usage } = await ai.image({
    prompt,
    width: 1200,
    height: 800,
    retryOnBlack: true,
    ...(brand.loraId ? { lora: brand.loraId } : {}),
    purpose: "contentpush story-billede",
  });

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Billed-download fejlede: HTTP ${res.status}`);
  const bytes = new Uint8Array(await res.arrayBuffer());

  const { variants } = await transformImage(bytes, {
    keepOriginal: true,
    variants: [
      { name: "thumb", maxEdge: 320, format: "webp", quality: 80 },
      { name: "grid", maxEdge: 800, format: "webp", quality: 80 },
      { name: "full", maxEdge: 1600, format: "webp", quality: 85 },
    ],
  });

  const baseKey = `ai/${crypto.randomUUID()}`;
  for (const v of variants) {
    await media.upload(variantKey(baseKey, v.name, v.contentType), v.bytes, {
      contentType: v.contentType,
    });
  }

  const [item] = await db
    .insert(tables.mediaLibrary)
    .values({ url: baseKey, type: "ai-image", description: headline })
    .returning();

  return { mediaId: item.id, costUsd: usage?.costUsd };
}

import { eq, inArray } from "drizzle-orm";
import { ai } from "./ai";
import { media, variantKey } from "./media";
import { db, tables } from "../db";
import { env } from "../env";

// F003.3: brand-stil-LoRA. Trænes ÉN gang per brand via ai.trainStyle (fal,
// flux-lora-fast-training). GDPR-guard: træningen kører US-hosted, så sættet
// SKAL være brand-only (logoer/produkter/visuals, aldrig ansigter/persondata)
// — kalderen afkræves eksplicit bekræftelse i API'et. Persondata/portrætter
// hører til BFL EU-portræt-stien (F009.3), aldrig her.
// Træning tager ~2-5 min → svar-straks + baggrundsjob (samme mønster som
// cron-tickets pipeline-fyld), status polles.

type TrainingState = { startedAt: number; error: string | null };
const training = new Map<string, TrainingState>();

export function styleTrainingStatus(brandId: string): {
  training: boolean;
  error: string | null;
} {
  const state = training.get(brandId);
  if (!state) return { training: false, error: null };
  return { training: state.error === null, error: state.error };
}

export function styleAvailable(): boolean {
  return Boolean(env.FAL_KEY) && media !== null;
}

/**
 * Starter baggrunds-træning af en brand-stil-LoRA fra billeder i biblioteket.
 * Kaster ved ugyldigt input; selve træningsfejl lander i status (pollbar).
 */
export async function startStyleTraining(
  brand: typeof tables.brandProfiles.$inferSelect,
  mediaIds: string[],
): Promise<void> {
  if (!env.FAL_KEY) throw new Error("FAL_KEY ikke sat (ship-dark)");
  if (!media) throw new Error("Media-storage ikke konfigureret (ship-dark)");
  const store = media;
  if (styleTrainingStatus(brand.id).training) {
    throw new Error("Træning kører allerede for dette brand");
  }

  const items = await db
    .select()
    .from(tables.mediaLibrary)
    .where(inArray(tables.mediaLibrary.id, mediaIds));
  if (items.length !== mediaIds.length) {
    throw new Error("Et eller flere billeder findes ikke i biblioteket");
  }

  // Signerede URL'er (privat R2-bucket) — SDK'et zipper dem in-memory til fal
  const urls = await Promise.all(
    items.map((item) => store.signedUrl(variantKey(item.url, "full", "image/webp"))),
  );

  training.set(brand.id, { startedAt: Date.now(), error: null });
  void (async () => {
    try {
      console.log(`[style] ${brand.name}: træner LoRA på ${urls.length} billeder …`);
      const { loraUrl, usage } = await ai.trainStyle({
        images: urls,
        isStyle: true,
        purpose: `contentpush brand-stil: ${brand.name}`,
        labels: { brand: brand.name },
      });
      await db
        .update(tables.brandProfiles)
        .set({ loraId: loraUrl })
        .where(eq(tables.brandProfiles.id, brand.id));
      training.delete(brand.id);
      console.log(
        `[style] ${brand.name}: LoRA klar ($${usage?.costUsd ?? "?"}) — bruges nu i al billed-generering`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[style] ${brand.name}: træning fejlede — ${message}`);
      training.set(brand.id, { startedAt: Date.now(), error: message });
    }
  })();
}

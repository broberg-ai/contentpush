import { asc, eq } from "drizzle-orm";
import sharp from "sharp";
import { ai } from "./ai";
import { media } from "./media";
import {
  renderStillClip,
  renderCardImage,
  concatClips,
  concatAudio,
  type Aspect,
} from "./videoRender";
import { db, tables } from "../db";

// F016.2 — drejebog → færdig speaket promo-video. Pr. scene: materialisér et
// visual (still via ai.image / AI-broll via ai.animate / logo- eller placeholder-
// kort) i scenens varighed, saml alle klip via videoRender-sømmen → én mp4.
//
// VOICEOVER er wired SHIP-DARK: uden en TTS-nøgle (ELEVENLABS/AZURE) laves ingen
// tale endnu → tavs video, og scene-varigheden bruger ÷150-estimatet. Når nøglen
// lander tændes talen (ai.tts) og den RIGTIGE lydlængde driver scene-varigheden.

const MAX_SCENES = 5; // MVP-kap: lange drejebøger kappes (og logges)
const ANIMATE_OVERRIDE = {
  provider: "fal",
  model: "fal-ai/kling-video/v2.5-turbo/pro/image-to-video",
} as const;

type ScriptRow = typeof tables.videoScripts.$inferSelect;
type SceneRow = typeof tables.videoScenes.$inferSelect;
type BrandRow = typeof tables.brandProfiles.$inferSelect;

const ASPECT_DIMS: Record<Aspect, { w: number; h: number }> = {
  "16:9": { w: 1280, h: 720 },
  "9:16": { w: 720, h: 1280 },
};

/** Er en TTS-nøgle sat? (ship-dark: tale er inaktiv indtil da) */
export function ttsAvailable(): boolean {
  return Boolean(process.env.AZURE_SPEECH_KEY || process.env.ELEVENLABS_API_KEY);
}

// Blessed rute (ai-sdk 2026-07-18): Azure Neural — native dansk, EU/GDPR, ~10×
// billigere end ElevenLabs, dækker da+en med én nøgle. Stemme driver outputtet.
const VOICE_BY_LANG: Record<string, string> = { da: "christel", en: "ava" };

function voText(scene: SceneRow, lang: string): string {
  return (lang === "en" ? scene.voiceoverEn : scene.voiceoverDa) ?? "";
}

/** Voiceover-lyd for én scene via ai.tts (Azure). null hvis ingen speak-tekst. */
async function sceneVoiceover(text: string, lang: string): Promise<Uint8Array | null> {
  if (!text.trim()) return null;
  const { audio } = await ai.tts({
    text,
    voice: VOICE_BY_LANG[lang] ?? "christel",
    lang: lang === "en" ? "en-US" : "da-DK",
    override: { provider: "azure", model: "neural" },
    purpose: "contentpush drejebog-voiceover",
  });
  return audio;
}

/** Scene-varighed fra speak-ordtal (÷150 wpm) — fallback indtil rigtig VO-lyd. */
function estDurationSec(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(2, Math.round((words / 150) * 60));
}

/** On-brand scene-still via ai.image (aldrig rå provider). */
async function sceneStill(
  prompt: string,
  aspect: Aspect,
  brand: BrandRow | undefined,
): Promise<Uint8Array> {
  const { w, h } = ASPECT_DIMS[aspect];
  const { url } = await ai.image({
    prompt: [
      `Editorial promo-video scene for the brand "${brand?.name ?? "brand"}".`,
      `Subject: ${prompt}.`,
      brand?.brandVoice ? `Mood: ${brand.brandVoice}.` : "",
      "Warm, calm, premium cinematic. Earthy palette. NO text, NO letters, NO logos, no people's faces.",
    ]
      .filter(Boolean)
      .join(" "),
    width: w,
    height: h,
    retryOnBlack: true,
    purpose: "contentpush drejebog-scene",
  });
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Scene-billede fejlede: HTTP ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}

/** Beskærer et still til formatet (til AI-broll, så Kling arver aspekten). */
async function cropTo(imageBytes: Uint8Array, aspect: Aspect): Promise<Uint8Array<ArrayBuffer>> {
  const { w, h } = ASPECT_DIMS[aspect];
  const out = await sharp(imageBytes).resize(w, h, { fit: "cover" }).jpeg({ quality: 90 }).toBuffer();
  const bytes = new Uint8Array(out.byteLength);
  bytes.set(out);
  return bytes;
}

// F016.4: det DYRE visual (ai.image/ai.animate) laves ÉN gang pr. scene og deles
// på tværs af sprog — kun VO + Ken Burns-varighed skifter pr. sprog (billig ffmpeg).
type SceneAsset =
  | { kind: "still"; image: Uint8Array }
  | { kind: "clip"; clip: Uint8Array }
  | { kind: "card"; image: Uint8Array };

async function sceneAsset(
  scene: SceneRow,
  script: ScriptRow,
  brand: BrandRow | undefined,
): Promise<SceneAsset> {
  const aspect = script.aspect as Aspect;
  const prompt = scene.visualPrompt?.trim() || script.title;
  switch (scene.visualType) {
    case "ai-broll": {
      const still = await sceneStill(prompt, aspect, brand);
      const cropped = await cropTo(still, aspect);
      const { url, bytes } = await ai.animate({
        image: cropped,
        prompt: "Subtle cinematic motion: gentle push-in, soft light shift. Keep composition.",
        durationSec: 5,
        override: ANIMATE_OVERRIDE,
        purpose: "contentpush drejebog-broll",
      });
      if (bytes) return { kind: "clip", clip: bytes };
      const res = await fetch(url);
      if (!res.ok) throw new Error(`AI-broll download fejlede: HTTP ${res.status}`);
      return { kind: "clip", clip: new Uint8Array(await res.arrayBuffer()) };
    }
    case "logo":
      return {
        kind: "card",
        image: await renderCardImage({ title: brand?.name ?? "Brand", subtitle: scene.onScreenText ?? undefined, aspect }),
      };
    case "ui-capture":
      // UDSKUDT (Lens record-flow, gap 019f71ac) — placeholder, ingen crash
      return {
        kind: "card",
        image: await renderCardImage({ title: "UI-optagelse", subtitle: "kommer — afventer Lens-optagelse", aspect }),
      };
    case "still":
    default:
      return { kind: "still", image: await sceneStill(prompt, aspect, brand) };
  }
}

/** Bygger scenens klip for ÉT sprog fra det delte asset (varighed = sprogets VO). */
async function sceneClipFor(
  asset: SceneAsset,
  scene: SceneRow,
  lang: string,
  aspect: Aspect,
): Promise<Uint8Array> {
  if (asset.kind === "clip") return asset.clip; // AI-broll: sprog-uafhængigt
  const dur = estDurationSec(voText(scene, lang));
  const capped = scene.visualType === "ui-capture" ? Math.min(dur, 3) : dur;
  const caption = asset.kind === "card" ? undefined : (scene.onScreenText ?? undefined);
  return renderStillClip({ imageBytes: asset.image, aspect, durationSec: capped, caption });
}

export interface CompileResult {
  renders: Array<{ language: string; mediaId: string }>;
  scenesRendered: number;
  scenesCapped: number;
  hasVoiceover: boolean;
}

/**
 * Kompilerer en drejebog til én mp4 PR. SPROG (begge sprog i ét kald), lagrer
 * dem i R2 + media_library + video_script_renders. Scene-stills deles på tværs
 * af sprog. Sætter renderStatus undervejs. Kaster ved fejl — kalderen sætter 'failed'.
 */
export async function compileScript(scriptId: string): Promise<CompileResult> {
  if (!media) throw new Error("Video-storage ikke konfigureret (ship-dark)");

  const [script] = await db
    .select()
    .from(tables.videoScripts)
    .where(eq(tables.videoScripts.id, scriptId));
  if (!script) throw new Error("Ukendt drejebog");

  const allScenes = await db
    .select()
    .from(tables.videoScenes)
    .where(eq(tables.videoScenes.scriptId, scriptId))
    .orderBy(asc(tables.videoScenes.order));
  if (allScenes.length === 0) throw new Error("Drejebogen har ingen scener");

  const scenes = allScenes.slice(0, MAX_SCENES);
  const capped = allScenes.length - scenes.length;
  if (capped > 0) console.warn(`[compile] ${scriptId}: kappet til ${MAX_SCENES} scener (${capped} udeladt)`);

  const [brand] = await db
    .select()
    .from(tables.brandProfiles)
    .where(eq(tables.brandProfiles.id, script.brandId));

  const languages =
    script.languages && script.languages.length > 0 ? script.languages : ["da"];

  await db
    .update(tables.videoScripts)
    .set({ renderStatus: "rendering" })
    .where(eq(tables.videoScripts.id, scriptId));

  const aspect = script.aspect as Aspect;
  // Dyre visuals ÉN gang (delt på tværs af sprog)
  const assets: SceneAsset[] = [];
  for (const scene of scenes) assets.push(await sceneAsset(scene, script, brand));

  // Erstat forrige renders
  await db.delete(tables.videoScriptRenders).where(eq(tables.videoScriptRenders.scriptId, scriptId));

  const renders: Array<{ language: string; mediaId: string }> = [];
  let anyVo = false;
  for (const lang of languages) {
    const clips: Uint8Array[] = [];
    for (let i = 0; i < scenes.length; i++) {
      clips.push(await sceneClipFor(assets[i], scenes[i], lang, aspect));
    }
    // Voiceover (ship-dark): kun når nøgle sat OG alle scener har speak i sproget
    let voTrack: Uint8Array | undefined;
    if (ttsAvailable()) {
      const voClips: Uint8Array[] = [];
      let allHaveVo = true;
      for (const scene of scenes) {
        const vo = await sceneVoiceover(voText(scene, lang), lang);
        if (!vo) { allHaveVo = false; break; }
        voClips.push(vo);
      }
      if (allHaveVo && voClips.length > 0) { voTrack = await concatAudio(voClips); anyVo = true; }
      else console.warn(`[compile] ${scriptId}: ikke alle scener har speak (${lang}) → tavs`);
    }

    const { bytes } = await concatClips({ clips, aspect, audio: voTrack });
    const key = `video/${crypto.randomUUID()}/drejebog-${lang}.mp4`;
    await media.upload(key, bytes, { contentType: "video/mp4" });
    const [item] = await db
      .insert(tables.mediaLibrary)
      .values({ url: key, type: "video", description: `${script.title} (${lang})` })
      .returning();
    await db
      .insert(tables.videoScriptRenders)
      .values({ scriptId, language: lang, mediaId: item.id });
    renders.push({ language: lang, mediaId: item.id });
  }

  await db
    .update(tables.videoScripts)
    .set({ renderStatus: "ready", renderMediaId: renders[0]?.mediaId ?? null, renderLang: languages[0] })
    .where(eq(tables.videoScripts.id, scriptId));

  return { renders, scenesRendered: scenes.length, scenesCapped: capped, hasVoiceover: anyVo };
}

/** Signerede video-URL'er pr. sprog for en drejebog (til preview/download). */
export async function scriptRenderUrls(scriptId: string): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  if (!media) return out;
  const rows = await db
    .select({ language: tables.videoScriptRenders.language, url: tables.mediaLibrary.url })
    .from(tables.videoScriptRenders)
    .leftJoin(tables.mediaLibrary, eq(tables.videoScriptRenders.mediaId, tables.mediaLibrary.id))
    .where(eq(tables.videoScriptRenders.scriptId, scriptId));
  for (const r of rows) {
    if (r.url) out[r.language] = await media.signedUrl(r.url);
  }
  return out;
}

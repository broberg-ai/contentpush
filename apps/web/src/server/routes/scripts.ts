import { Hono } from "hono";
import { z } from "zod";
import { asc, eq } from "drizzle-orm";
import { parseJsonLoose } from "@broberg/ai-sdk";
import { db, tables } from "../db";
import { ai } from "../lib/ai";
import { compileScript, scriptRenderUrls } from "../lib/scriptCompile";

// F016.1: Drejebog-editor — CRUD for video_scripts + video_scenes + AI-udkast
// ("Foreslå manus"). ALT AI går via @broberg/ai-sdk (ai.chat) — aldrig rå provider.
// Selve video-kompileringen er F016.2 (separat kort, blokeret) — her gemmer vi
// KUN drejebogen.

const aspectEnum = z.enum(["16:9", "9:16"]);
const roleEnum = z.enum(["hook", "problem", "solution", "proof", "cta"]);
const visualEnum = z.enum(["ai-broll", "ui-capture", "still", "logo"]);
const transEnum = z.enum(["cut", "fade", "slide"]);

const scriptCreate = z.object({
  brandId: z.string().min(1),
  title: z.string().min(1, "Titel er påkrævet"),
  aspect: aspectEnum.optional(),
  languages: z.array(z.string()).optional(),
  targetDurationSec: z.number().int().positive().optional(),
});
const scriptPatch = z.object({
  title: z.string().min(1).optional(),
  aspect: aspectEnum.optional(),
  languages: z.array(z.string()).optional(),
  targetDurationSec: z.number().int().positive().optional(),
  musicEnabled: z.boolean().optional(),
  musicTrackId: z.string().nullable().optional(),
  status: z.enum(["draft", "ready"]).optional(),
});
const sceneCreate = z.object({
  order: z.number().int().nonnegative().optional(),
  role: roleEnum,
  visualType: visualEnum.optional(),
  visualPrompt: z.string().nullable().optional(),
  flowRef: z.string().nullable().optional(),
  mediaId: z.string().nullable().optional(),
  voiceoverDa: z.string().nullable().optional(),
  voiceoverEn: z.string().nullable().optional(),
  onScreenText: z.string().nullable().optional(),
  transition: transEnum.optional(),
});
const scenePatch = sceneCreate.partial();

function serializeScript(s: typeof tables.videoScripts.$inferSelect) {
  return { ...s, createdAt: s.createdAt?.toISOString() ?? null };
}
function serializeScene(s: typeof tables.videoScenes.$inferSelect) {
  return { ...s, createdAt: s.createdAt?.toISOString() ?? null };
}

async function scenesFor(scriptId: string) {
  const rows = await db
    .select()
    .from(tables.videoScenes)
    .where(eq(tables.videoScenes.scriptId, scriptId))
    .orderBy(asc(tables.videoScenes.order));
  return rows.map(serializeScene);
}

// F016.1: AI-manus-udkast (hook→problem→løsning→bevis→CTA), da+en speak.
async function suggestScenes(
  brand: typeof tables.brandProfiles.$inferSelect,
  targetSec: number,
): Promise<Array<z.infer<typeof sceneCreate>>> {
  const prompt = [
    `Du skriver en drejebog til en kort promo-video for brandet "${brand.name}".`,
    brand.companyContext ? `Brand-kontekst: ${brand.companyContext}` : "",
    brand.brandVoice ? `Brand-stemme: ${brand.brandVoice}` : "",
    `Mål-længde: ~${targetSec} sekunder. Voiceover læses ~150 ord/min, så hele manuset skal være ca. ${Math.round((targetSec / 60) * 150)} ord i ALT (fordelt på scenerne).`,
    `Struktur (præcis 5 scener, én pr. rolle, i denne rækkefølge): hook, problem, solution, proof, cta.`,
    `Hook leder med seerens PROBLEM, ikke produktet. CTA har ét klart næste-skridt.`,
    `For hver scene: en kort visual-prompt (dansk, on-brand, ingen tekst i billedet), og speak på BÅDE dansk (voiceoverDa) og engelsk (voiceoverEn).`,
    `Svar KUN med JSON på formen: {"scenes":[{"role":"hook","visualType":"ai-broll","visualPrompt":"...","voiceoverDa":"...","voiceoverEn":"...","onScreenText":"","transition":"fade"}, ...]}`,
    `visualType skal være en af: ai-broll, ui-capture, still, logo. transition: cut, fade, slide. Sidste scene (cta) bør bruge visualType "logo".`,
  ]
    .filter(Boolean)
    .join("\n");

  const { text } = await ai.chat({ prompt, tier: "cheap" });
  const parsed = parseJsonLoose(text) as { scenes?: unknown } | null;
  const raw = Array.isArray(parsed?.scenes) ? parsed!.scenes : [];
  const out: Array<z.infer<typeof sceneCreate>> = [];
  for (const s of raw) {
    const r = sceneCreate.safeParse(s);
    if (r.success) out.push(r.data);
  }
  if (out.length === 0) throw new Error("AI-udkast kunne ikke parses til scener");
  return out;
}

export const scriptsRoute = new Hono()
  .get("/", async (c) => {
    const rows = await db
      .select({
        id: tables.videoScripts.id,
        brandId: tables.videoScripts.brandId,
        brandName: tables.brandProfiles.name,
        title: tables.videoScripts.title,
        aspect: tables.videoScripts.aspect,
        targetDurationSec: tables.videoScripts.targetDurationSec,
        status: tables.videoScripts.status,
        createdAt: tables.videoScripts.createdAt,
      })
      .from(tables.videoScripts)
      .leftJoin(
        tables.brandProfiles,
        eq(tables.videoScripts.brandId, tables.brandProfiles.id),
      )
      .orderBy(asc(tables.videoScripts.createdAt));
    return c.json({
      scripts: rows.map((r) => ({
        ...r,
        createdAt: r.createdAt?.toISOString() ?? null,
      })),
    });
  })
  .post("/", async (c) => {
    const body = scriptCreate.safeParse(await c.req.json().catch(() => null));
    if (!body.success) {
      return c.json({ error: "Ugyldig body", details: body.error.flatten() }, 400);
    }
    const d = body.data;
    const [script] = await db
      .insert(tables.videoScripts)
      .values({
        brandId: d.brandId,
        title: d.title,
        aspect: d.aspect ?? "16:9",
        languages: d.languages ?? ["da", "en"],
        targetDurationSec: d.targetDurationSec ?? 60,
      })
      .returning();
    return c.json({ script: serializeScript(script), scenes: [] }, 201);
  })
  .get("/:id", async (c) => {
    const [script] = await db
      .select()
      .from(tables.videoScripts)
      .where(eq(tables.videoScripts.id, c.req.param("id")));
    if (!script) return c.json({ error: "Ukendt drejebog" }, 404);
    return c.json({
      script: serializeScript(script),
      scenes: await scenesFor(script.id),
      // F016.4: signerede video-URL'er pr. sprog (tom indtil "Byg video")
      renderUrls: await scriptRenderUrls(script.id),
    });
  })
  .patch("/:id", async (c) => {
    const body = scriptPatch.safeParse(await c.req.json().catch(() => null));
    if (!body.success) {
      return c.json({ error: "Ugyldig body", details: body.error.flatten() }, 400);
    }
    const d = body.data;
    const set: Partial<typeof tables.videoScripts.$inferInsert> = {};
    if (d.title !== undefined) set.title = d.title;
    if (d.aspect !== undefined) set.aspect = d.aspect;
    if (d.languages !== undefined) set.languages = d.languages;
    if (d.targetDurationSec !== undefined) set.targetDurationSec = d.targetDurationSec;
    if (d.musicEnabled !== undefined) set.musicEnabled = d.musicEnabled;
    if (d.musicTrackId !== undefined) set.musicTrackId = d.musicTrackId;
    if (d.status !== undefined) set.status = d.status;
    const [script] = await db
      .update(tables.videoScripts)
      .set(set)
      .where(eq(tables.videoScripts.id, c.req.param("id")))
      .returning();
    if (!script) return c.json({ error: "Ukendt drejebog" }, 404);
    return c.json({ script: serializeScript(script) });
  })
  .delete("/:id", async (c) => {
    const id = c.req.param("id");
    await db.delete(tables.videoScenes).where(eq(tables.videoScenes.scriptId, id));
    const [script] = await db
      .delete(tables.videoScripts)
      .where(eq(tables.videoScripts.id, id))
      .returning();
    if (!script) return c.json({ error: "Ukendt drejebog" }, 404);
    return c.json({ deleted: script.id });
  })
  // scener
  .post("/:id/scenes", async (c) => {
    const body = sceneCreate.safeParse(await c.req.json().catch(() => null));
    if (!body.success) {
      return c.json({ error: "Ugyldig body", details: body.error.flatten() }, 400);
    }
    const scriptId = c.req.param("id");
    const existing = await db
      .select({ order: tables.videoScenes.order })
      .from(tables.videoScenes)
      .where(eq(tables.videoScenes.scriptId, scriptId));
    const nextOrder = existing.reduce((m, r) => Math.max(m, r.order + 1), 0);
    const d = body.data;
    const [scene] = await db
      .insert(tables.videoScenes)
      .values({
        scriptId,
        order: d.order ?? nextOrder,
        role: d.role,
        visualType: d.visualType ?? "ai-broll",
        visualPrompt: d.visualPrompt ?? null,
        flowRef: d.flowRef ?? null,
        mediaId: d.mediaId ?? null,
        voiceoverDa: d.voiceoverDa ?? null,
        voiceoverEn: d.voiceoverEn ?? null,
        onScreenText: d.onScreenText ?? null,
        transition: d.transition ?? "cut",
      })
      .returning();
    return c.json({ scene: serializeScene(scene) }, 201);
  })
  .patch("/scenes/:sceneId", async (c) => {
    const body = scenePatch.safeParse(await c.req.json().catch(() => null));
    if (!body.success) {
      return c.json({ error: "Ugyldig body", details: body.error.flatten() }, 400);
    }
    const d = body.data;
    const set: Partial<typeof tables.videoScenes.$inferInsert> = {};
    if (d.order !== undefined) set.order = d.order;
    if (d.role !== undefined) set.role = d.role;
    if (d.visualType !== undefined) set.visualType = d.visualType;
    if (d.visualPrompt !== undefined) set.visualPrompt = d.visualPrompt;
    if (d.flowRef !== undefined) set.flowRef = d.flowRef;
    if (d.mediaId !== undefined) set.mediaId = d.mediaId;
    if (d.voiceoverDa !== undefined) set.voiceoverDa = d.voiceoverDa;
    if (d.voiceoverEn !== undefined) set.voiceoverEn = d.voiceoverEn;
    if (d.onScreenText !== undefined) set.onScreenText = d.onScreenText;
    if (d.transition !== undefined) set.transition = d.transition;
    const [scene] = await db
      .update(tables.videoScenes)
      .set(set)
      .where(eq(tables.videoScenes.id, c.req.param("sceneId")))
      .returning();
    if (!scene) return c.json({ error: "Ukendt scene" }, 404);
    return c.json({ scene: serializeScene(scene) });
  })
  .delete("/scenes/:sceneId", async (c) => {
    const [scene] = await db
      .delete(tables.videoScenes)
      .where(eq(tables.videoScenes.id, c.req.param("sceneId")))
      .returning();
    if (!scene) return c.json({ error: "Ukendt scene" }, 404);
    return c.json({ deleted: scene.id });
  })
  // F016.1: "Foreslå manus" — AI-udkast → erstatter scenerne
  .post("/:id/suggest", async (c) => {
    const scriptId = c.req.param("id");
    const [script] = await db
      .select()
      .from(tables.videoScripts)
      .where(eq(tables.videoScripts.id, scriptId));
    if (!script) return c.json({ error: "Ukendt drejebog" }, 404);
    const [brand] = await db
      .select()
      .from(tables.brandProfiles)
      .where(eq(tables.brandProfiles.id, script.brandId));
    if (!brand) return c.json({ error: "Ukendt brand" }, 404);

    let suggested: Array<z.infer<typeof sceneCreate>>;
    try {
      suggested = await suggestScenes(brand, script.targetDurationSec);
    } catch (err) {
      return c.json(
        { error: err instanceof Error ? err.message : "AI-udkast fejlede" },
        502,
      );
    }

    // erstat eksisterende scener med udkastet
    await db.delete(tables.videoScenes).where(eq(tables.videoScenes.scriptId, scriptId));
    await db.insert(tables.videoScenes).values(
      suggested.map((s, i) => ({
        scriptId,
        order: i,
        role: s.role,
        visualType: s.visualType ?? (s.role === "cta" ? "logo" : "ai-broll"),
        visualPrompt: s.visualPrompt ?? null,
        voiceoverDa: s.voiceoverDa ?? null,
        voiceoverEn: s.voiceoverEn ?? null,
        onScreenText: s.onScreenText ?? null,
        transition: s.transition ?? "cut",
      })),
    );
    return c.json({ scenes: await scenesFor(scriptId) });
  })
  // F016.4: "Byg video" — kompilér drejebogen til én mp4 PR. SPROG (begge i ét).
  // Langt kald (AI-billeder/klip + ffmpeg, minutter). VO ship-dark (Azure-nøgle).
  .post("/:id/compile", async (c) => {
    const scriptId = c.req.param("id");
    const [script] = await db
      .select()
      .from(tables.videoScripts)
      .where(eq(tables.videoScripts.id, scriptId));
    if (!script) return c.json({ error: "Ukendt drejebog" }, 404);
    try {
      const result = await compileScript(scriptId);
      const [updated] = await db
        .select()
        .from(tables.videoScripts)
        .where(eq(tables.videoScripts.id, scriptId));
      return c.json({
        script: serializeScript(updated),
        renderUrls: await scriptRenderUrls(scriptId),
        ...result,
      });
    } catch (err) {
      await db
        .update(tables.videoScripts)
        .set({ renderStatus: "failed" })
        .where(eq(tables.videoScripts.id, scriptId));
      const message = err instanceof Error ? err.message : String(err);
      return c.json({ error: `Kompilering fejlede: ${message}` }, 503);
    }
  });

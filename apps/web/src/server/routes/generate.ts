import { Hono } from "hono";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { parseJsonLoose } from "@broberg/ai-sdk";
import { ai } from "../lib/ai";
import { db, tables } from "../db";

export const PLATFORMS = ["linkedin", "instagram", "facebook"] as const;
export type Platform = (typeof PLATFORMS)[number];

export type GeneratedContent = Record<
  string,
  { text: string; hashtags: string[] }
>;

const platformHints: Record<Platform, string> = {
  linkedin:
    "Professionel, indsigtsdrevet. 2-4 korte afsnit. 3-5 hashtags til sidst.",
  instagram:
    "Visuel, personlig, letlæst. Korte linjer, gerne emoji hvor det er naturligt. 8-15 hashtags.",
  facebook:
    "Samtale-agtig, community-orienteret. 1-2 afsnit + evt. et spørgsmål. 1-3 hashtags.",
};

/** Genererer post-tekst + hashtags per platform. Genbruges af cron-hook (F004.2). */
export async function generatePostTexts(input: {
  headline: string;
  companyContext?: string;
  brandVoice?: string;
  platforms?: string[];
  /** F012.3: Christians rå idé-tekst — indgår VERBATIM og vinder over frie vinkler */
  ideaText?: string;
}): Promise<{ content: GeneratedContent; costUsd?: number }> {
  const platforms = (
    input.platforms?.length ? input.platforms : [...PLATFORMS]
  ).filter((p): p is Platform => (PLATFORMS as readonly string[]).includes(p));

  const prompt = [
    "Du er en social media-tekstforfatter. Skriv opslag på dansk ud fra headline og brand-kontekst.",
    input.ideaText
      ? `Christians idé — byg opslaget på DEN (ordret, uredigeret): """${input.ideaText}"""`
      : "",
    `Headline: ${input.headline}`,
    input.companyContext ? `Brand-kontekst: ${input.companyContext}` : "",
    input.brandVoice ? `Brand voice/tone: ${input.brandVoice}` : "",
    "",
    "Platforme og stil:",
    ...platforms.map((p) => `- ${p}: ${platformHints[p]}`),
    "",
    "Svar KUN med gyldig JSON, intet andet — præcis dette format:",
    `{${platforms.map((p) => `"${p}": {"text": "…", "hashtags": ["#…"]}`).join(", ")}}`,
    "VIGTIGT: skriv ALDRIG hashtags inde i text-feltet — de hører KUN hjemme i hashtags-arrayet.",
  ]
    .filter((line) => line !== "")
    .join("\n");

  const { text, usage } = await ai.chat({ prompt, tier: "cheap" });
  const parsed = parseJsonLoose(text) as GeneratedContent | null;

  if (!parsed || typeof parsed !== "object") {
    throw new Error("AI-svar kunne ikke parses som JSON");
  }
  for (const p of platforms) {
    if (!parsed[p]?.text?.trim() || !Array.isArray(parsed[p]?.hashtags)) {
      throw new Error(`AI-svar mangler indhold for platformen "${p}"`);
    }
  }

  return { content: parsed, costUsd: usage?.costUsd };
}

const bodySchema = z.object({
  headline: z.string().min(1),
  brandId: z.string().min(1).optional(),
  companyContext: z.string().optional(),
  brandVoice: z.string().optional(),
  platforms: z.array(z.string()).optional(),
});

export const generateRoute = new Hono().post("/", async (c) => {
  const body = bodySchema.safeParse(await c.req.json().catch(() => null));
  if (!body.success) {
    return c.json({ error: "Ugyldig body", details: body.error.flatten() }, 400);
  }

  const { headline, brandId, ...overrides } = body.data;

  let brand;
  if (brandId) {
    [brand] = await db
      .select()
      .from(tables.brandProfiles)
      .where(eq(tables.brandProfiles.id, brandId));
    if (!brand) return c.json({ error: "Ukendt brandId" }, 404);
    // F010.2: en ikke-godkendt kladde kan ALDRIG bruges til nye posts
    if (brand.status === "draft") {
      return c.json({ error: "Kladde-profil skal godkendes før den kan bruges" }, 409);
    }
  }

  try {
    const { content, costUsd } = await generatePostTexts({
      headline,
      companyContext: overrides.companyContext ?? brand?.companyContext ?? undefined,
      brandVoice: overrides.brandVoice ?? brand?.brandVoice ?? undefined,
      platforms: overrides.platforms ?? brand?.platforms ?? undefined,
    });

    // Med et brand gemmes udkastet som draft-post (dashboardets kø, F005)
    let post;
    if (brand) {
      [post] = await db
        .insert(tables.posts)
        .values({
          brandId: brand.id,
          headline,
          linkedinText: content.linkedin?.text,
          instagramText: content.instagram?.text,
          facebookText: content.facebook?.text,
          hashtags: Object.fromEntries(
            Object.entries(content).map(([p, v]) => [p, v.hashtags]),
          ),
        })
        .returning();
    }

    return c.json({ content, costUsd, post });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // Ship-dark: manglende AI-nøgle må ikke vælte appen — klar 503 i stedet
    return c.json({ error: `Generering fejlede: ${message}` }, 503);
  }
});

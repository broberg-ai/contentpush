import { Hono } from "hono";
import { z } from "zod";
import { and, desc, eq, ne } from "drizzle-orm";
import { ai } from "../lib/ai";
import { db, tables } from "../db";

// F012.3: Idé-biblioteket. rawText er hellig — gemmes verbatim, omskrives
// aldrig. AI-berigelsen vælger KUN brand (når intet er angivet), aldrig tekst.

async function suggestBrand(
  rawText: string,
): Promise<{ brandId: string | null; enriched: boolean }> {
  const brands = await db.select().from(tables.brandProfiles);
  if (!brands.length) return { brandId: null, enriched: false };
  try {
    const { text } = await ai.chat({
      prompt: [
        "Hvilket brand hører denne idé til et social media-opslag til?",
        `Idé: """${rawText}"""`,
        `Brands: ${brands.map((b) => b.name).join(" · ")}`,
        "Svar KUN med det ene brand-navn, præcis som skrevet. Er du i tvivl, svar: ukendt",
      ].join("\n"),
      tier: "cheap",
    });
    const name = text.trim().toLowerCase();
    const match = brands.find((b) => b.name.toLowerCase() === name);
    return { brandId: match?.id ?? null, enriched: Boolean(match) };
  } catch {
    // Ship-dark: manglende AI-nøgle → idéen gemmes stadig (status captured)
    return { brandId: null, enriched: false };
  }
}

const createSchema = z.object({
  rawText: z.string().trim().min(1),
  brandId: z.string().min(1).optional(),
});

const patchSchema = z.object({
  brandId: z.string().min(1).nullable().optional(),
  status: z.enum(["captured", "enriched", "planned", "archived"]).optional(),
});

export const ideasRoute = new Hono()
  .get("/", async (c) => {
    const rows = await db
      .select({ idea: tables.ideas, brandName: tables.brandProfiles.name })
      .from(tables.ideas)
      .leftJoin(
        tables.brandProfiles,
        eq(tables.ideas.brandId, tables.brandProfiles.id),
      )
      .where(ne(tables.ideas.status, "archived"))
      .orderBy(desc(tables.ideas.createdAt));
    return c.json({
      ideas: rows.map(({ idea, brandName }) => ({ ...idea, brandName })),
    });
  })
  .post("/", async (c) => {
    const body = createSchema.safeParse(await c.req.json().catch(() => null));
    if (!body.success) {
      return c.json({ error: "Ugyldig body", details: body.error.flatten() }, 400);
    }
    const explicitBrand = body.data.brandId ?? null;
    const [idea] = await db
      .insert(tables.ideas)
      .values({
        rawText: body.data.rawText,
        brandId: explicitBrand,
        status: explicitBrand ? "enriched" : "captured",
      })
      .returning();

    // Berigelse i BAGGRUNDEN — svaret venter aldrig på AI (målt 36s).
    // Guard på status='captured' så en imens arkiveret idé ikke genoplives.
    if (!explicitBrand) {
      void suggestBrand(idea.rawText)
        .then(async ({ brandId, enriched }) => {
          if (!enriched) return;
          await db
            .update(tables.ideas)
            .set({ brandId, status: "enriched" })
            .where(
              and(eq(tables.ideas.id, idea.id), eq(tables.ideas.status, "captured")),
            );
        })
        .catch(() => {});
    }

    return c.json({ idea });
  })
  .patch("/:id", async (c) => {
    const body = patchSchema.safeParse(await c.req.json().catch(() => null));
    if (!body.success) {
      return c.json({ error: "Ugyldig body", details: body.error.flatten() }, 400);
    }
    const [idea] = await db
      .update(tables.ideas)
      .set(body.data)
      .where(eq(tables.ideas.id, c.req.param("id")))
      .returning();
    if (!idea) return c.json({ error: "Ukendt idé" }, 404);
    return c.json({ idea });
  });

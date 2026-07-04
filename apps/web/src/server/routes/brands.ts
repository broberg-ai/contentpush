import { Hono } from "hono";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, tables } from "../db";
import {
  startStyleTraining,
  styleAvailable,
  styleTrainingStatus,
} from "../lib/style";

// F002.2: list + patch (kontekst/voice). Fuld CRUD (opret/arkivér) kommer i F009.1.
const patchSchema = z.object({
  companyContext: z.string().optional(),
  brandVoice: z.string().optional(),
});

// F003.3: GDPR-guard — træning kører US-hosted (fal), så sættet skal
// EKSPLICIT bekræftes brand-only (ingen ansigter/persondata). Uden
// bekræftelsen afvises kaldet; portrætter hører til BFL EU-stien (F009.3).
const trainSchema = z.object({
  mediaIds: z.array(z.string()).min(4, "Vælg mindst 4 billeder"),
  confirmBrandOnly: z.literal(true, {
    message: "Bekræft at træningssættet er brand-only (ingen ansigter/persondata)",
  }),
});

export const brandsRoute = new Hono()
  // F010.1: default = kun aktive (kladder er F010.2's review-flade: ?status=draft)
  .get("/", async (c) => {
    const status = c.req.query("status") === "draft" ? "draft" : "active";
    const brands = await db
      .select()
      .from(tables.brandProfiles)
      .where(eq(tables.brandProfiles.status, status));
    return c.json({ brands });
  })
  .patch("/:id", async (c) => {
    const body = patchSchema.safeParse(await c.req.json().catch(() => null));
    if (!body.success) {
      return c.json({ error: "Ugyldig body", details: body.error.flatten() }, 400);
    }
    const [brand] = await db
      .update(tables.brandProfiles)
      .set(body.data)
      .where(eq(tables.brandProfiles.id, c.req.param("id")))
      .returning();
    if (!brand) return c.json({ error: "Ukendt brand" }, 404);
    return c.json({ brand });
  })
  // F003.3: træn brand-stil-LoRA (baggrundsjob, ~2-5 min) + pollbar status
  .post("/:id/train-style", async (c) => {
    if (!styleAvailable()) {
      return c.json({ error: "Billed-generering er ikke konfigureret (ship-dark)" }, 503);
    }
    const body = trainSchema.safeParse(await c.req.json().catch(() => null));
    if (!body.success) {
      return c.json({ error: "Ugyldig body", details: body.error.flatten() }, 400);
    }
    const [brand] = await db
      .select()
      .from(tables.brandProfiles)
      .where(eq(tables.brandProfiles.id, c.req.param("id")));
    if (!brand) return c.json({ error: "Ukendt brand" }, 404);
    if (styleTrainingStatus(brand.id).training) {
      return c.json({ error: "Træning kører allerede for dette brand" }, 409);
    }
    try {
      await startStyleTraining(brand, body.data.mediaIds);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return c.json({ error: message }, 400);
    }
    return c.json({ status: "training" }, 202);
  })
  .get("/:id/style-status", async (c) => {
    const [brand] = await db
      .select()
      .from(tables.brandProfiles)
      .where(eq(tables.brandProfiles.id, c.req.param("id")));
    if (!brand) return c.json({ error: "Ukendt brand" }, 404);
    return c.json({ ...styleTrainingStatus(brand.id), loraId: brand.loraId });
  });

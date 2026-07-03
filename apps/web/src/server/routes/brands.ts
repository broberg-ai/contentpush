import { Hono } from "hono";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, tables } from "../db";

// F002.2: list + patch (kontekst/voice). Fuld CRUD (opret/arkivér) kommer i F009.1.
const patchSchema = z.object({
  companyContext: z.string().optional(),
  brandVoice: z.string().optional(),
});

export const brandsRoute = new Hono()
  .get("/", async (c) => {
    const brands = await db.select().from(tables.brandProfiles);
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
  });

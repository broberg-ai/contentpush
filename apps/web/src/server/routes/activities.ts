import { Hono } from "hono";
import { z } from "zod";
import { asc, eq } from "drizzle-orm";
import { db, tables } from "../db";

// F013.1: Årshjulet — CRUD for aktiviteter (produktions-ordrer).
const typeEnum = z.enum(["kampagne", "serie", "lancering", "maerkedag"]);

const baseSchema = z.object({
  title: z.string().min(1, "Titel er påkrævet"),
  type: typeEnum,
  periodStart: z.string().min(1),
  periodEnd: z.string().min(1),
  brandIds: z.array(z.string()).nullable().optional(),
  channels: z.array(z.string()).nullable().optional(),
  cadencePerBrand: z.number().int().positive().optional(),
  toneInstruks: z.string().nullable().optional(),
  generatePolicy: z.enum(["auto", "manual"]).optional(),
});
const patchSchema = baseSchema.partial();

function serialize(a: typeof tables.activities.$inferSelect) {
  return {
    ...a,
    periodStart: a.periodStart?.toISOString() ?? null,
    periodEnd: a.periodEnd?.toISOString() ?? null,
    createdAt: a.createdAt?.toISOString() ?? null,
  };
}

export const activitiesRoute = new Hono()
  .get("/", async (c) => {
    const rows = await db
      .select()
      .from(tables.activities)
      .orderBy(asc(tables.activities.periodStart));
    return c.json({ activities: rows.map(serialize) });
  })
  .post("/", async (c) => {
    const body = baseSchema.safeParse(await c.req.json().catch(() => null));
    if (!body.success) {
      return c.json({ error: "Ugyldig body", details: body.error.flatten() }, 400);
    }
    const d = body.data;
    const [activity] = await db
      .insert(tables.activities)
      .values({
        title: d.title,
        type: d.type,
        periodStart: new Date(d.periodStart),
        periodEnd: new Date(d.periodEnd),
        brandIds: d.brandIds ?? null,
        channels: d.channels ?? null,
        cadencePerBrand: d.cadencePerBrand ?? 1,
        toneInstruks: d.toneInstruks ?? null,
        generatePolicy: d.generatePolicy ?? "auto",
      })
      .returning();
    return c.json({ activity: serialize(activity) }, 201);
  })
  .patch("/:id", async (c) => {
    const body = patchSchema.safeParse(await c.req.json().catch(() => null));
    if (!body.success) {
      return c.json({ error: "Ugyldig body", details: body.error.flatten() }, 400);
    }
    const d = body.data;
    const set: Partial<typeof tables.activities.$inferInsert> = {};
    if (d.title !== undefined) set.title = d.title;
    if (d.type !== undefined) set.type = d.type;
    if (d.periodStart !== undefined) set.periodStart = new Date(d.periodStart);
    if (d.periodEnd !== undefined) set.periodEnd = new Date(d.periodEnd);
    if (d.brandIds !== undefined) set.brandIds = d.brandIds;
    if (d.channels !== undefined) set.channels = d.channels;
    if (d.cadencePerBrand !== undefined) set.cadencePerBrand = d.cadencePerBrand;
    if (d.toneInstruks !== undefined) set.toneInstruks = d.toneInstruks;
    if (d.generatePolicy !== undefined) set.generatePolicy = d.generatePolicy;

    const [activity] = await db
      .update(tables.activities)
      .set(set)
      .where(eq(tables.activities.id, c.req.param("id")))
      .returning();
    if (!activity) return c.json({ error: "Ukendt aktivitet" }, 404);
    return c.json({ activity: serialize(activity) });
  })
  .delete("/:id", async (c) => {
    const [activity] = await db
      .delete(tables.activities)
      .where(eq(tables.activities.id, c.req.param("id")))
      .returning();
    if (!activity) return c.json({ error: "Ukendt aktivitet" }, 404);
    return c.json({ deleted: activity.id });
  });

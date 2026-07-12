import { Hono } from "hono";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, tables } from "../db";
import { danishHolidays } from "../lib/holidays";
import { resolveWindows } from "../lib/windows";

// F013.3: timing — mærkedage (undgå|udnyt) + tidsvinduer per platform×brand.
const markerSchema = z.object({
  title: z.string().min(1, "Titel er påkrævet"),
  kind: z.enum(["avoid", "use"]),
  month: z.number().int().min(1).max(12),
  day: z.number().int().min(1).max(31),
  brandId: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
});

const windowSchema = z.object({
  brandId: z.string().nullable().optional(),
  platform: z.string().min(1),
  weekdays: z.array(z.number().int().min(0).max(6)),
  bestWeekday: z.number().int().min(0).max(6).nullable().optional(),
  startMin: z.number().int().min(0).max(1440),
  endMin: z.number().int().min(0).max(1440),
});

export const timingRoute = new Hono()
  // Kombineret kalender: auto-helligdage + egne mærkedage (global + brandets)
  .get("/calendar", async (c) => {
    const year = Number(c.req.query("year")) || new Date().getFullYear();
    const brandId = c.req.query("brandId") || null;
    const auto = danishHolidays(year);
    const own = await db.select().from(tables.markerDays);
    const ownForBrand = own
      .filter((m) => m.brandId === null || m.brandId === brandId)
      .map((m) => ({
        date: `${year}-${String(m.month).padStart(2, "0")}-${String(m.day).padStart(2, "0")}`,
        title: m.title,
        kind: m.kind,
        source: "egen" as const,
        id: m.id,
      }));
    return c.json({ days: [...auto, ...ownForBrand] });
  })
  .get("/markers", async (c) => {
    const rows = await db.select().from(tables.markerDays);
    return c.json({ markers: rows });
  })
  .post("/markers", async (c) => {
    const body = markerSchema.safeParse(await c.req.json().catch(() => null));
    if (!body.success) {
      return c.json({ error: "Ugyldig body", details: body.error.flatten() }, 400);
    }
    const [marker] = await db
      .insert(tables.markerDays)
      .values({ ...body.data, brandId: body.data.brandId ?? null, note: body.data.note ?? null })
      .returning();
    return c.json({ marker }, 201);
  })
  .delete("/markers/:id", async (c) => {
    const [m] = await db
      .delete(tables.markerDays)
      .where(eq(tables.markerDays.id, c.req.param("id")))
      .returning();
    if (!m) return c.json({ error: "Ukendt mærkedag" }, 404);
    return c.json({ deleted: m.id });
  })
  // Tidsvinduer (defaults hvis ingen i DB)
  .get("/windows", async (c) => {
    const brandId = c.req.query("brandId") || null;
    return c.json({ windows: await resolveWindows(brandId) });
  })
  // Upsert et vindue (persistér override)
  .put("/windows", async (c) => {
    const body = windowSchema.safeParse(await c.req.json().catch(() => null));
    if (!body.success) {
      return c.json({ error: "Ugyldig body", details: body.error.flatten() }, 400);
    }
    const d = body.data;
    const brandId = d.brandId ?? null;
    const existing = await db.select().from(tables.postingWindows);
    const match = existing.find((r) => r.brandId === brandId && r.platform === d.platform);
    if (match) {
      const [w] = await db
        .update(tables.postingWindows)
        .set({
          weekdays: d.weekdays,
          bestWeekday: d.bestWeekday ?? null,
          startMin: d.startMin,
          endMin: d.endMin,
        })
        .where(eq(tables.postingWindows.id, match.id))
        .returning();
      return c.json({ window: w });
    }
    const [w] = await db
      .insert(tables.postingWindows)
      .values({
        brandId,
        platform: d.platform,
        weekdays: d.weekdays,
        bestWeekday: d.bestWeekday ?? null,
        startMin: d.startMin,
        endMin: d.endMin,
      })
      .returning();
    return c.json({ window: w }, 201);
  });

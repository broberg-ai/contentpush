import { Hono } from "hono";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db, tables } from "../db";
import {
  AUTODOC_TARGETS,
  autodocConfigured,
  importBrandDraft,
} from "../lib/autodoc";

// F010.1: discovery-consumer. AutoDoc ejer motoren; her kun hent + map.
const importSchema = z.object({
  slug: z.string().min(1),
});

// F010.2: godkendelse — Christians redigerede felter påføres profilen.
// Først HER bliver en profil aktiv (aldrig automatisk).
const approveSchema = z.object({
  name: z.string().min(1),
  siteUrl: z.string().nullable().optional(),
  companyContext: z.string().nullable().optional(),
  brandVoice: z.string().nullable().optional(),
  platforms: z.array(z.string()).nullable().optional(),
  postingIntervalDays: z.number().int().positive(),
});

export const discoveryRoute = new Hono()
  .get("/targets", async (c) => {
    const drafts = await db
      .select()
      .from(tables.brandProfiles)
      .where(eq(tables.brandProfiles.status, "draft"));
    const targets = AUTODOC_TARGETS.map((t) => {
      const draft = drafts.find((d) => d.autodocSlug === t.slug);
      return {
        slug: t.slug,
        brandName: t.brandName,
        configured: autodocConfigured(t.slug),
        draft: draft ?? null,
      };
    });
    return c.json({ targets });
  })
  .post("/import", async (c) => {
    const body = importSchema.safeParse(await c.req.json().catch(() => null));
    if (!body.success) {
      return c.json({ error: "Ugyldig body", details: body.error.flatten() }, 400);
    }
    const { slug } = body.data;
    if (!AUTODOC_TARGETS.some((t) => t.slug === slug)) {
      return c.json({ error: `Ukendt AutoDoc-target: ${slug}` }, 404);
    }
    if (!autodocConfigured(slug)) {
      return c.json({ error: `AutoDoc-token for ${slug} ikke sat (ship-dark)` }, 503);
    }
    try {
      const { draft, updated } = await importBrandDraft(slug);
      return c.json({ draft, updated });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return c.json({ error: message }, 502);
    }
  })
  // F010.2: godkend en kladde → aktiv. Har kladden en source (eksisterende
  // aktivt brand) opdateres DET brand med de godkendte felter og kladden
  // slettes; ellers promoveres kladden selv til aktiv. Idempotent-sikker:
  // godkendelse er den ENESTE vej fra draft → active.
  .post("/drafts/:id/approve", async (c) => {
    const body = approveSchema.safeParse(await c.req.json().catch(() => null));
    if (!body.success) {
      return c.json({ error: "Ugyldig body", details: body.error.flatten() }, 400);
    }
    const [draft] = await db
      .select()
      .from(tables.brandProfiles)
      .where(
        and(
          eq(tables.brandProfiles.id, c.req.param("id")),
          eq(tables.brandProfiles.status, "draft"),
        ),
      );
    if (!draft) return c.json({ error: "Ukendt kladde" }, 404);

    const fields = {
      name: body.data.name,
      siteUrl: body.data.siteUrl ?? null,
      companyContext: body.data.companyContext ?? null,
      brandVoice: body.data.brandVoice ?? null,
      platforms: body.data.platforms ?? null,
      postingIntervalDays: body.data.postingIntervalDays,
    };

    if (draft.sourceBrandId) {
      const [active] = await db
        .update(tables.brandProfiles)
        .set(fields)
        .where(
          and(
            eq(tables.brandProfiles.id, draft.sourceBrandId),
            eq(tables.brandProfiles.status, "active"),
          ),
        )
        .returning();
      if (active) {
        await db.delete(tables.brandProfiles).where(eq(tables.brandProfiles.id, draft.id));
        return c.json({ brand: active, mode: "updated-existing" });
      }
      // source forsvandt → fald tilbage til promovering
    }

    const [active] = await db
      .update(tables.brandProfiles)
      .set({ ...fields, status: "active", sourceBrandId: null })
      .where(eq(tables.brandProfiles.id, draft.id))
      .returning();
    return c.json({ brand: active, mode: "promoted" });
  })
  // Kladde-oprydning (aldrig aktive): slet en draft-profil igen
  .delete("/drafts/:id", async (c) => {
    const [draft] = await db
      .delete(tables.brandProfiles)
      .where(
        and(
          eq(tables.brandProfiles.id, c.req.param("id")),
          eq(tables.brandProfiles.status, "draft"),
        ),
      )
      .returning();
    if (!draft) return c.json({ error: "Ukendt kladde" }, 404);
    return c.json({ deleted: draft.id });
  });

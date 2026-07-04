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
        draftId: draft?.id ?? null,
        analyzedAt: draft?.analyzedAt ?? null,
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

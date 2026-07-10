import { and, eq } from "drizzle-orm";
import { db, tables } from "../db";
import { env } from "../env";

// F010.1: AutoDoc-consumer. AutoDoc EJER discovery-motoren (Christians
// arkitektur-beslutning 2026-07-03) — contentpush henter kun den færdige
// analyse (funktionel model + brand_signals + grounding) og mapper den til
// en KLADDE-brand-profil. INGEN egen crawl/vision her. Kladden aktiveres
// aldrig automatisk — Christians godkendelse (F010.2) flipper status.

const AUTODOC_BASE_URL = "https://broberg-autodoc.fly.dev/api/v1";

/** v1-targets: Christians egne produkter, enrolled i AutoDoc. Én kilde. */
export const AUTODOC_TARGETS = [
  { slug: "broberg-ai", brandName: "broberg.ai", token: () => env.AUTODOC_KEY_BROBERG_AI },
  { slug: "cardmem", brandName: "cardmem.com", token: () => env.AUTODOC_KEY_CARDMEM_COM },
  { slug: "trailmem", brandName: "trailmem.com", token: () => env.AUTODOC_KEY_TRAILMEM_COM },
] as const;

/** Platforme appen understøtter i dag (F014/F015 udvider senere). */
const SUPPORTED_PLATFORMS = new Set(["linkedin", "instagram", "facebook"]);

type BrandSignals = {
  voice?: string;
  tone?: string[];
  audience?: string;
  themes?: string[];
  visualStyleNotes?: string;
  language?: string;
  platformCues?: { platform: string; fit: string; rationale?: string }[];
  suggestedPostingIntervalDays?: number;
  postingIntervalRationale?: string;
};

type ConsumerModel = {
  projectSlug: string;
  brandSignals: BrandSignals;
  grounding: {
    productName?: string;
    siteUrl?: string;
    readmeSummary?: string;
    docExcerpts?: string[];
  };
  analyzedAt: string;
};

export function autodocConfigured(slug: string): boolean {
  const target = AUTODOC_TARGETS.find((t) => t.slug === slug);
  return Boolean(target?.token());
}

async function fetchModel(slug: string): Promise<ConsumerModel> {
  const target = AUTODOC_TARGETS.find((t) => t.slug === slug);
  if (!target) throw new Error(`Ukendt AutoDoc-target: ${slug}`);
  const token = target.token();
  if (!token) throw new Error(`AutoDoc-token for ${slug} ikke sat (ship-dark)`);

  const res = await fetch(`${AUTODOC_BASE_URL}/consumer/${slug}/model`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`AutoDoc svarede HTTP ${res.status} for ${slug}`);
  return (await res.json()) as ConsumerModel;
}

/** brand_signals + grounding → profil-felter (kladde). */
function mapToProfile(model: ConsumerModel) {
  const s = model.brandSignals;
  const g = model.grounding;

  const companyContext = [
    g.readmeSummary,
    s.audience ? `Målgruppe: ${s.audience}` : "",
    s.themes?.length ? `Temaer: ${s.themes.join(", ")}` : "",
    s.visualStyleNotes ? `Visuel stil: ${s.visualStyleNotes}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const brandVoice = [s.voice, s.tone?.length ? `Tone: ${s.tone.join(", ")}` : ""]
    .filter(Boolean)
    .join("\n");

  // Kun platforme appen kender; fit 'skip' udelades. Resten står i rå signals.
  const platforms = (s.platformCues ?? [])
    .filter((c) => c.fit !== "skip" && SUPPORTED_PLATFORMS.has(c.platform.toLowerCase()))
    .map((c) => c.platform.toLowerCase());

  return {
    name: g.productName ?? model.projectSlug,
    siteUrl: g.siteUrl ?? null,
    companyContext: companyContext || null,
    brandVoice: brandVoice || null,
    platforms: platforms.length ? platforms : null,
    postingIntervalDays: s.suggestedPostingIntervalDays ?? 14,
  };
}

/**
 * Henter discovery for et target og upserter en kladde-profil (status='draft').
 * Idempotent: eksisterende kladde for samme slug overskrives in-place.
 */
export async function importBrandDraft(slug: string) {
  const model = await fetchModel(slug);
  const mapped = mapToProfile(model);
  const target = AUTODOC_TARGETS.find((t) => t.slug === slug)!;

  // Kladden linker til det aktive brand den foreslår en opdatering af
  const [sourceBrand] = await db
    .select()
    .from(tables.brandProfiles)
    .where(
      and(
        eq(tables.brandProfiles.name, target.brandName),
        eq(tables.brandProfiles.status, "active"),
      ),
    );

  const values = {
    ...mapped,
    status: "draft" as const,
    sourceBrandId: sourceBrand?.id ?? null,
    autodocSlug: slug,
    brandSignals: model.brandSignals,
    grounding: model.grounding,
    analyzedAt: new Date(model.analyzedAt),
  };

  const [existingDraft] = await db
    .select()
    .from(tables.brandProfiles)
    .where(
      and(
        eq(tables.brandProfiles.autodocSlug, slug),
        eq(tables.brandProfiles.status, "draft"),
      ),
    );

  if (existingDraft) {
    const [draft] = await db
      .update(tables.brandProfiles)
      .set(values)
      .where(eq(tables.brandProfiles.id, existingDraft.id))
      .returning();
    return { draft, updated: true };
  }
  const [draft] = await db.insert(tables.brandProfiles).values(values).returning();
  return { draft, updated: false };
}

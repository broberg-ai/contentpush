import { useEffect, useState } from "preact/hooks";

// F010.2: gennemsyn + godkendelse af AutoDoc-kladde-profiler. Ingen profil
// bliver aktiv uden Christians eksplicitte godkendelse her. Berigelses-kilden
// (AutoDoc grounding + brand_signals, analyseret-tidspunkt) vises ved siden af
// de redigerbare felter, så forslaget kan kvalificeres før det aktiveres.

const PLATFORMS = ["linkedin", "instagram", "facebook"] as const;

type BrandSignals = {
  audience?: string;
  themes?: string[];
  tone?: string[];
  visualStyleNotes?: string;
  platformCues?: { platform: string; fit: string; rationale?: string }[];
  postingIntervalRationale?: string;
};
type Grounding = {
  productName?: string;
  siteUrl?: string;
  readmeSummary?: string;
};
type Draft = {
  id: string;
  name: string;
  siteUrl: string | null;
  companyContext: string | null;
  brandVoice: string | null;
  platforms: string[] | null;
  postingIntervalDays: number;
  brandSignals: BrandSignals | null;
  grounding: Grounding | null;
  analyzedAt: string | null;
};
type Target = {
  slug: string;
  brandName: string;
  configured: boolean;
  draft: Draft | null;
};

type RowState = { busy: null | "import" | "approve" | "discard"; error: string | null };

export function BrandDrafts({ onChanged }: { onChanged?: () => void }) {
  const [targets, setTargets] = useState<Target[] | null>(null);
  const [edits, setEdits] = useState<Record<string, Partial<Draft>>>({});
  const [rowState, setRowState] = useState<Record<string, RowState>>({});

  async function load() {
    const res = await fetch("/api/discovery/targets");
    if (!res.ok) return;
    const { targets } = (await res.json()) as { targets: Target[] };
    setTargets(targets);
  }
  useEffect(() => {
    load();
  }, []);

  function setRow(slug: string, patch: Partial<RowState>) {
    setRowState((s) => ({ ...s, [slug]: { ...{ busy: null, error: null }, ...s[slug], ...patch } }));
  }
  function field<K extends keyof Draft>(draft: Draft, key: K): Draft[K] {
    const e = edits[draft.id];
    return (e && key in e ? (e[key] as Draft[K]) : draft[key]);
  }
  function edit(draftId: string, patch: Partial<Draft>) {
    setEdits((s) => ({ ...s, [draftId]: { ...s[draftId], ...patch } }));
  }

  async function importTarget(slug: string) {
    setRow(slug, { busy: "import", error: null });
    try {
      const res = await fetch("/api/discovery/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug }),
      });
      const b = await res.json();
      if (!res.ok) throw new Error(b.error ?? `HTTP ${res.status}`);
      await load();
      setRow(slug, { busy: null });
    } catch (err) {
      setRow(slug, { busy: null, error: err instanceof Error ? err.message : String(err) });
    }
  }

  async function approve(target: Target, draft: Draft) {
    setRow(target.slug, { busy: "approve", error: null });
    try {
      const res = await fetch(`/api/discovery/drafts/${draft.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: field(draft, "name"),
          siteUrl: field(draft, "siteUrl"),
          companyContext: field(draft, "companyContext"),
          brandVoice: field(draft, "brandVoice"),
          platforms: field(draft, "platforms"),
          postingIntervalDays: field(draft, "postingIntervalDays"),
        }),
      });
      const b = await res.json();
      if (!res.ok) throw new Error(b.error ?? `HTTP ${res.status}`);
      setEdits((s) => {
        const next = { ...s };
        delete next[draft.id];
        return next;
      });
      await load();
      setRow(target.slug, { busy: null });
      onChanged?.();
    } catch (err) {
      setRow(target.slug, { busy: null, error: err instanceof Error ? err.message : String(err) });
    }
  }

  async function discard(target: Target, draft: Draft) {
    setRow(target.slug, { busy: "discard", error: null });
    try {
      const res = await fetch(`/api/discovery/drafts/${draft.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await load();
      setRow(target.slug, { busy: null });
    } catch (err) {
      setRow(target.slug, { busy: null, error: err instanceof Error ? err.message : String(err) });
    }
  }

  function togglePlatform(draft: Draft, p: string) {
    const cur = field(draft, "platforms") ?? [];
    edit(draft.id, cur.includes(p) ? { platforms: cur.filter((x) => x !== p) } : { platforms: [...cur, p] });
  }

  if (!targets) return null;

  return (
    <section class="brand-drafts" data-testid="brand-drafts">
      <h2>Brand-kladder fra AutoDoc</h2>
      <p class="drafts-sub">
        Contentpush foreslår en brand-profil ud fra AutoDocs analyse af dine
        produkter. Gennemse, redigér og godkend — først da bliver profilen aktiv.
      </p>

      {targets.map((t) => {
        const rs = rowState[t.slug] ?? { busy: null, error: null };
        const draft = t.draft;
        return (
          <div class="draft-target" data-testid={`draft-target-${t.slug}`} key={t.slug}>
            <div class="draft-target-head">
              <strong>{t.brandName}</strong>
              {!t.configured && (
                <span class="draft-badge muted" data-testid={`draft-unconfigured-${t.slug}`}>
                  AutoDoc-nøgle mangler
                </span>
              )}
              {draft?.analyzedAt && (
                <span class="draft-badge" data-testid={`draft-analyzed-${t.slug}`}>
                  Analyseret {new Date(draft.analyzedAt).toLocaleDateString("da-DK")}
                </span>
              )}
              <button
                type="button"
                class="btn-secondary"
                data-testid={`draft-import-${t.slug}`}
                disabled={!t.configured || rs.busy !== null}
                onClick={() => importTarget(t.slug)}
              >
                {rs.busy === "import" ? "Henter…" : draft ? "Genhent" : "Hent forslag"}
              </button>
            </div>

            {draft && (
              <div class="draft-body" data-testid={`draft-body-${t.slug}`}>
                <div class="draft-fields">
                  <label>
                    Navn
                    <input
                      type="text"
                      data-testid={`draft-name-${t.slug}`}
                      value={field(draft, "name") ?? ""}
                      onInput={(e) => edit(draft.id, { name: (e.target as HTMLInputElement).value })}
                    />
                  </label>
                  <label>
                    Brand-kontekst
                    <textarea
                      rows={4}
                      data-testid={`draft-context-${t.slug}`}
                      value={field(draft, "companyContext") ?? ""}
                      onInput={(e) => edit(draft.id, { companyContext: (e.target as HTMLTextAreaElement).value })}
                    />
                  </label>
                  <label>
                    Brand voice / tone
                    <textarea
                      rows={3}
                      data-testid={`draft-voice-${t.slug}`}
                      value={field(draft, "brandVoice") ?? ""}
                      onInput={(e) => edit(draft.id, { brandVoice: (e.target as HTMLTextAreaElement).value })}
                    />
                  </label>
                  <div class="draft-platforms" data-testid={`draft-platforms-${t.slug}`}>
                    <span class="draft-field-label">Platforme</span>
                    <div class="platform-toggles">
                      {PLATFORMS.map((p) => {
                        const on = (field(draft, "platforms") ?? []).includes(p);
                        return (
                          <button
                            key={p}
                            type="button"
                            class={`platform-toggle${on ? " on" : ""}`}
                            data-testid={`draft-platform-${t.slug}-${p}`}
                            aria-pressed={on}
                            onClick={() => togglePlatform(draft, p)}
                          >
                            {p}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <label class="draft-interval">
                    Kadence (dage mellem opslag)
                    <input
                      type="number"
                      min={1}
                      data-testid={`draft-interval-${t.slug}`}
                      value={field(draft, "postingIntervalDays") ?? 14}
                      onInput={(e) =>
                        edit(draft.id, {
                          postingIntervalDays: Number((e.target as HTMLInputElement).value) || 14,
                        })
                      }
                    />
                  </label>
                </div>

                <aside class="draft-source" data-testid={`draft-source-${t.slug}`}>
                  <h4>Kilde: AutoDoc-analyse</h4>
                  {draft.grounding?.readmeSummary && (
                    <p class="source-summary">{draft.grounding.readmeSummary}</p>
                  )}
                  {draft.brandSignals?.audience && (
                    <p><strong>Målgruppe:</strong> {draft.brandSignals.audience}</p>
                  )}
                  {draft.brandSignals?.themes?.length ? (
                    <p><strong>Temaer:</strong> {draft.brandSignals.themes.join(", ")}</p>
                  ) : null}
                  {draft.brandSignals?.platformCues?.length ? (
                    <ul class="source-cues">
                      {draft.brandSignals.platformCues.map((cue) => (
                        <li key={cue.platform}>
                          <strong>{cue.platform}</strong> — {cue.fit}
                          {cue.rationale ? `: ${cue.rationale}` : ""}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {draft.brandSignals?.postingIntervalRationale && (
                    <p class="source-note">{draft.brandSignals.postingIntervalRationale}</p>
                  )}
                </aside>

                <div class="draft-actions">
                  <button
                    type="button"
                    class="btn-primary"
                    data-testid={`draft-approve-${t.slug}`}
                    disabled={rs.busy !== null}
                    onClick={() => approve(t, draft)}
                  >
                    {rs.busy === "approve" ? "Godkender…" : "Godkend + aktivér"}
                  </button>
                  <button
                    type="button"
                    class="btn-secondary"
                    data-testid={`draft-discard-${t.slug}`}
                    disabled={rs.busy !== null}
                    onClick={() => discard(t, draft)}
                  >
                    {rs.busy === "discard" ? "Kasserer…" : "Kassér"}
                  </button>
                </div>
              </div>
            )}

            {rs.error && (
              <p class="save-error" data-testid={`draft-error-${t.slug}`}>
                {rs.error}
              </p>
            )}
          </div>
        );
      })}
    </section>
  );
}

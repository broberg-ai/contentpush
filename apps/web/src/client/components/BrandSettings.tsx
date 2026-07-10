import { useEffect, useState } from "preact/hooks";
import { BrandStyle } from "./BrandStyle";

type Brand = {
  id: string;
  name: string;
  siteUrl: string | null;
  companyContext: string | null;
  brandVoice: string | null;
  platforms: string[] | null;
  postingIntervalDays: number;
};

type SaveState = "idle" | "saving" | "saved" | "error";

const PLATFORMS = ["linkedin", "instagram", "facebook"] as const;
const EMPTY_NEW = { name: "", siteUrl: "", postingIntervalDays: 14 };

export function BrandSettings({ onChanged }: { onChanged?: () => void }) {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Brand | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [creating, setCreating] = useState(false);
  const [newBrand, setNewBrand] = useState({ ...EMPTY_NEW });
  const [createState, setCreateState] = useState<SaveState>("idle");

  function load(selectAfter?: string | null) {
    return fetch("/api/brands")
      .then((r) => r.json())
      .then(({ brands }: { brands: Brand[] }) => {
        setBrands(brands);
        const pick =
          selectAfter !== undefined
            ? brands.find((b) => b.id === selectAfter) ?? brands[0]
            : brands.find((b) => b.id === selectedId) ?? brands[0];
        if (pick) selectBrand(pick);
        else {
          setSelectedId(null);
          setDraft(null);
        }
      });
  }

  useEffect(() => {
    load(undefined);
  }, []);

  function selectBrand(brand: Brand) {
    setSelectedId(brand.id);
    setDraft({ ...brand });
    setSaveState("idle");
  }

  function edit(patch: Partial<Brand>) {
    setDraft((d) => (d ? { ...d, ...patch } : d));
  }

  function togglePlatform(p: string) {
    if (!draft) return;
    const cur = draft.platforms ?? [];
    edit({ platforms: cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p] });
  }

  async function save() {
    if (!draft) return;
    setSaveState("saving");
    try {
      const res = await fetch(`/api/brands/${draft.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: draft.name,
          siteUrl: draft.siteUrl,
          companyContext: draft.companyContext,
          brandVoice: draft.brandVoice,
          platforms: draft.platforms,
          postingIntervalDays: draft.postingIntervalDays,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await load(draft.id);
      setSaveState("saved");
      onChanged?.();
      setTimeout(() => setSaveState("idle"), 2500);
    } catch {
      setSaveState("error");
    }
  }

  async function archive() {
    if (!draft) return;
    setSaveState("saving");
    try {
      const res = await fetch(`/api/brands/${draft.id}/archive`, { method: "POST" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await load(null);
      setSaveState("idle");
      onChanged?.();
    } catch {
      setSaveState("error");
    }
  }

  async function create() {
    if (!newBrand.name.trim()) return;
    setCreateState("saving");
    try {
      const res = await fetch("/api/brands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newBrand.name.trim(),
          siteUrl: newBrand.siteUrl.trim() || null,
          postingIntervalDays: newBrand.postingIntervalDays,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      setNewBrand({ ...EMPTY_NEW });
      setCreating(false);
      setCreateState("idle");
      await load(body.brand.id);
      onChanged?.();
    } catch {
      setCreateState("error");
    }
  }

  return (
    <section class="brand-settings" data-testid="brand-settings">
      <div class="brand-settings-head">
        <h2>Brands</h2>
        <button
          type="button"
          class="btn-secondary"
          data-testid="brand-new-button"
          onClick={() => setCreating((v) => !v)}
        >
          {creating ? "Annullér" : "Nyt brand"}
        </button>
      </div>

      {creating && (
        <form
          class="brand-create-form"
          data-testid="brand-create-form"
          onSubmit={(e) => {
            e.preventDefault();
            create();
          }}
        >
          <input
            type="text"
            placeholder="Brand-navn"
            data-testid="brand-new-name"
            value={newBrand.name}
            onInput={(e) => setNewBrand({ ...newBrand, name: (e.target as HTMLInputElement).value })}
          />
          <input
            type="text"
            placeholder="Site-URL (valgfri)"
            data-testid="brand-new-site"
            value={newBrand.siteUrl}
            onInput={(e) => setNewBrand({ ...newBrand, siteUrl: (e.target as HTMLInputElement).value })}
          />
          <button
            type="submit"
            class="btn-primary"
            data-testid="brand-new-submit"
            disabled={createState === "saving" || !newBrand.name.trim()}
          >
            {createState === "saving" ? "Opretter…" : "Opret brand"}
          </button>
          {createState === "error" && (
            <span class="save-error" data-testid="brand-new-error">Kunne ikke oprette</span>
          )}
        </form>
      )}

      <div class="brand-picker" data-testid="brand-picker" role="tablist">
        {brands.map((b) => (
          <button
            key={b.id}
            type="button"
            role="tab"
            aria-selected={b.id === selectedId}
            class={`brand-pill${b.id === selectedId ? " active" : ""}`}
            data-testid={`brand-pill-${b.id}`}
            onClick={() => selectBrand(b)}
          >
            {b.name}
          </button>
        ))}
      </div>

      {draft && (
        <form
          class="brand-form"
          data-testid="brand-form"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <label>
            Navn
            <input
              type="text"
              data-testid="brand-name-input"
              value={draft.name}
              onInput={(e) => edit({ name: (e.target as HTMLInputElement).value })}
            />
          </label>
          <label>
            Site-URL
            <input
              type="text"
              data-testid="brand-site-input"
              value={draft.siteUrl ?? ""}
              onInput={(e) => edit({ siteUrl: (e.target as HTMLInputElement).value || null })}
            />
          </label>
          <label>
            Brand-kontekst (virksomhedsintro, genbruges i alle opslag)
            <textarea
              rows={5}
              value={draft.companyContext ?? ""}
              data-testid="brand-context-input"
              onInput={(e) => edit({ companyContext: (e.target as HTMLTextAreaElement).value })}
            />
          </label>
          <label>
            Brand voice / tone
            <textarea
              rows={3}
              value={draft.brandVoice ?? ""}
              data-testid="brand-voice-input"
              onInput={(e) => edit({ brandVoice: (e.target as HTMLTextAreaElement).value })}
            />
          </label>
          <div class="brand-platforms" data-testid="brand-platforms">
            <span class="draft-field-label">Platforme</span>
            <div class="platform-toggles">
              {PLATFORMS.map((p) => {
                const on = (draft.platforms ?? []).includes(p);
                return (
                  <button
                    key={p}
                    type="button"
                    class={`platform-toggle${on ? " on" : ""}`}
                    data-testid={`brand-platform-${p}`}
                    aria-pressed={on}
                    onClick={() => togglePlatform(p)}
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
              data-testid="brand-interval-input"
              value={draft.postingIntervalDays}
              onInput={(e) =>
                edit({ postingIntervalDays: Number((e.target as HTMLInputElement).value) || 14 })
              }
            />
          </label>
          <div class="brand-form-footer">
            <button
              type="submit"
              class="btn-primary"
              data-testid="brand-save-button"
              disabled={saveState === "saving"}
            >
              {saveState === "saving" ? "Gemmer…" : "Gem"}
            </button>
            <button
              type="button"
              class="btn-secondary"
              data-testid="brand-archive-button"
              disabled={saveState === "saving"}
              onClick={archive}
            >
              Arkivér
            </button>
            {saveState === "saved" && (
              <span class="save-confirm" data-testid="brand-save-confirm">Gemt ✓</span>
            )}
            {saveState === "error" && (
              <span class="save-error" data-testid="brand-save-error">Kunne ikke gemme — prøv igen</span>
            )}
          </div>
        </form>
      )}

      {selectedId && <BrandStyle brandId={selectedId} />}
    </section>
  );
}

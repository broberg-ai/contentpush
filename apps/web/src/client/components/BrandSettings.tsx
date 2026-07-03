import { useEffect, useState } from "preact/hooks";

type Brand = {
  id: string;
  name: string;
  siteUrl: string | null;
  companyContext: string | null;
  brandVoice: string | null;
};

type SaveState = "idle" | "saving" | "saved" | "error";

export function BrandSettings() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [companyContext, setCompanyContext] = useState("");
  const [brandVoice, setBrandVoice] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("idle");

  useEffect(() => {
    fetch("/api/brands")
      .then((r) => r.json())
      .then(({ brands }: { brands: Brand[] }) => {
        setBrands(brands);
        if (brands.length && !selectedId) selectBrand(brands[0]);
      });
  }, []);

  function selectBrand(brand: Brand) {
    setSelectedId(brand.id);
    setCompanyContext(brand.companyContext ?? "");
    setBrandVoice(brand.brandVoice ?? "");
    setSaveState("idle");
  }

  async function save() {
    if (!selectedId) return;
    setSaveState("saving");
    try {
      const res = await fetch(`/api/brands/${selectedId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyContext, brandVoice }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const { brand } = (await res.json()) as { brand: Brand };
      setBrands((all) => all.map((b) => (b.id === brand.id ? brand : b)));
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 2500);
    } catch {
      setSaveState("error");
    }
  }

  return (
    <section class="brand-settings" data-testid="brand-settings">
      <h2>Brand-indstillinger</h2>
      <div class="brand-picker" data-testid="brand-picker" role="tablist">
        {brands.map((b) => (
          <button
            key={b.id}
            type="button"
            role="tab"
            aria-selected={b.id === selectedId}
            class={`brand-pill${b.id === selectedId ? " active" : ""}`}
            data-testid={`brand-pill-${b.name.replace(/\W+/g, "-")}`}
            onClick={() => selectBrand(b)}
          >
            {b.name}
          </button>
        ))}
      </div>

      {selectedId && (
        <form
          class="brand-form"
          data-testid="brand-form"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <label>
            Brand-kontekst (virksomhedsintro, genbruges i alle opslag)
            <textarea
              rows={5}
              value={companyContext}
              data-testid="brand-context-input"
              onInput={(e) => setCompanyContext((e.target as HTMLTextAreaElement).value)}
            />
          </label>
          <label>
            Brand voice / tone
            <textarea
              rows={3}
              value={brandVoice}
              data-testid="brand-voice-input"
              onInput={(e) => setBrandVoice((e.target as HTMLTextAreaElement).value)}
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
            {saveState === "saved" && (
              <span class="save-confirm" data-testid="brand-save-confirm">
                Gemt ✓
              </span>
            )}
            {saveState === "error" && (
              <span class="save-error" data-testid="brand-save-error">
                Kunne ikke gemme — prøv igen
              </span>
            )}
          </div>
        </form>
      )}
    </section>
  );
}

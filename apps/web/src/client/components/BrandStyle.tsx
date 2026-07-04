import { useEffect, useRef, useState } from "preact/hooks";

// F003.3: brand-stil-LoRA — vælg brand-only billeder fra biblioteket,
// bekræft GDPR-guarden eksplicit, træn i baggrunden (~2-5 min) og pol status.

type LibraryItem = {
  id: string;
  type: string;
  description: string | null;
  thumbUrl: string | null;
};

type StyleStatus = { training: boolean; error: string | null; loraId: string | null };

const MIN_IMAGES = 4;

export function BrandStyle({ brandId }: { brandId: string }) {
  const [status, setStatus] = useState<StyleStatus | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmed, setConfirmed] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const pollTimer = useRef<number | null>(null);

  async function loadStatus(): Promise<StyleStatus | null> {
    try {
      const res = await fetch(`/api/brands/${brandId}/style-status`);
      if (!res.ok) return null;
      const s = (await res.json()) as StyleStatus;
      setStatus(s);
      return s;
    } catch {
      return null;
    }
  }

  // Status ved brand-skift + polling så længe træningen kører
  useEffect(() => {
    setStatus(null);
    setPickerOpen(false);
    setSelected(new Set());
    setConfirmed(false);
    setSubmitError(null);
    loadStatus();
    return () => {
      if (pollTimer.current !== null) clearTimeout(pollTimer.current);
    };
  }, [brandId]);

  useEffect(() => {
    if (!status?.training) return;
    pollTimer.current = window.setTimeout(loadStatus, 5000);
    return () => {
      if (pollTimer.current !== null) clearTimeout(pollTimer.current);
    };
  }, [status]);

  async function openPicker() {
    setPickerOpen(true);
    const res = await fetch("/api/library");
    const { items } = (await res.json()) as { items: LibraryItem[] };
    setItems(items);
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function train() {
    setSubmitError(null);
    try {
      const res = await fetch(`/api/brands/${brandId}/train-style`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mediaIds: [...selected], confirmBrandOnly: true }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      setPickerOpen(false);
      setSelected(new Set());
      setConfirmed(false);
      setStatus((s) => ({ training: true, error: null, loraId: s?.loraId ?? null }));
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : String(err));
    }
  }

  if (!status) return null;

  return (
    <div class="brand-style" data-testid="brand-style">
      <div class="brand-style-head">
        <h3>Brand-stil</h3>
        {status.training ? (
          <span class="style-status training" data-testid="brand-style-status">
            Træner… (2-5 min)
          </span>
        ) : status.loraId ? (
          <span class="style-status trained" data-testid="brand-style-status">
            Trænet ✓ — bruges i al billed-generering
          </span>
        ) : (
          <span class="style-status" data-testid="brand-style-status">
            Ikke trænet — billeder genereres uden fast brand-udtryk
          </span>
        )}
      </div>

      {status.error && (
        <p class="save-error" data-testid="brand-style-error">
          Seneste træning fejlede: {status.error}
        </p>
      )}

      {!status.training && !pickerOpen && (
        <button
          type="button"
          class="btn-secondary"
          data-testid="brand-style-open-picker"
          onClick={openPicker}
        >
          {status.loraId ? "Træn ny brand-stil" : "Træn brand-stil"}
        </button>
      )}

      {pickerOpen && !status.training && (
        <div class="style-picker" data-testid="brand-style-picker">
          <p class="style-picker-hint">
            Vælg mindst {MIN_IMAGES} billeder der viser brandets udtryk. Kun
            brand-billeder (logo, produkt, visuals) — <strong>aldrig ansigter
            eller persondata</strong>: træningen kører hos fal.ai (USA).
          </p>
          <div class="style-picker-grid" data-testid="brand-style-picker-grid">
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                class={`style-pick${selected.has(item.id) ? " selected" : ""}`}
                data-testid="brand-style-pick-item"
                aria-pressed={selected.has(item.id)}
                title={item.description ?? item.type}
                onClick={() => toggle(item.id)}
              >
                {item.thumbUrl ? (
                  <img src={item.thumbUrl} alt={item.description ?? ""} loading="lazy" />
                ) : (
                  <span class="style-pick-fallback">{item.type}</span>
                )}
                {selected.has(item.id) && <span class="style-pick-check">✓</span>}
              </button>
            ))}
            {items.length === 0 && (
              <p class="style-picker-empty" data-testid="brand-style-picker-empty">
                Biblioteket er tomt — upload eller generér billeder først.
              </p>
            )}
          </div>
          <label class="style-confirm" data-testid="brand-style-confirm">
            <input
              type="checkbox"
              checked={confirmed}
              data-testid="brand-style-confirm-checkbox"
              onChange={(e) => setConfirmed((e.target as HTMLInputElement).checked)}
            />
            <span>
              Jeg bekræfter at de valgte billeder er brand-only — ingen
              ansigter eller persondata
            </span>
          </label>
          <div class="style-picker-footer">
            <button
              type="button"
              class="btn-primary"
              data-testid="brand-style-train-button"
              disabled={selected.size < MIN_IMAGES || !confirmed}
              onClick={train}
            >
              Træn brand-stil ({selected.size}/{MIN_IMAGES} valgt)
            </button>
            <button
              type="button"
              class="btn-secondary"
              data-testid="brand-style-cancel"
              onClick={() => {
                setPickerOpen(false);
                setSubmitError(null);
              }}
            >
              Annullér
            </button>
          </div>
          {submitError && (
            <p class="save-error" data-testid="brand-style-submit-error">
              {submitError}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

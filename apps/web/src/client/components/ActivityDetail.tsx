import { useEffect, useState } from "preact/hooks";
import type { Activity } from "./YearWheel";

// F013.1: årshjul-event foldet ud (produktions-ordre). Jf. detalje-mockup:
// periode-minical (kampagne-måneder + produktions-vindue), tone-instruks-felt
// (vinder over AI'ens vinkler), dæknings-liste. Fuld sheet, ikke modal.

const MONTHS = ["jan", "feb", "mar", "apr", "maj", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];
const TYPE_LABEL: Record<Activity["type"], string> = {
  kampagne: "Kampagne",
  serie: "Serie",
  lancering: "Lancering",
  maerkedag: "Mærkedag",
};

type Brand = { id: string; name: string };

function daShort(iso: string) {
  return new Date(iso).toLocaleDateString("da-DK", { day: "numeric", month: "short" });
}

export function ActivityDetail({
  activity,
  onClose,
  onChanged,
}: {
  activity: Activity;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [tone, setTone] = useState(activity.toneInstruks ?? "");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [brands, setBrands] = useState<Brand[]>([]);

  useEffect(() => {
    setTone(activity.toneInstruks ?? "");
    setSaveState("idle");
  }, [activity.id]);

  useEffect(() => {
    fetch("/api/brands")
      .then((r) => r.json())
      .then(({ brands }: { brands: Brand[] }) => setBrands(brands))
      .catch(() => setBrands([]));
  }, []);

  const startMonth = new Date(activity.periodStart).getMonth();
  const endMonth = new Date(activity.periodEnd).getMonth();
  // produktions-vindue: 2 uger før periodStart
  const windowStart = new Date(activity.periodStart);
  windowStart.setDate(windowStart.getDate() - 14);
  const windowMonth = windowStart.getMonth();

  // dækning: aktivitetens brands (eller alle aktive) × kadence
  const targetBrands =
    activity.brandIds && activity.brandIds.length
      ? brands.filter((b) => activity.brandIds!.includes(b.id))
      : brands;
  const coverage = targetBrands.flatMap((b) =>
    Array.from({ length: activity.cadencePerBrand }, (_, i) => ({
      brand: b.name,
      idx: i + 1,
    })),
  );

  async function save() {
    setSaveState("saving");
    try {
      const res = await fetch(`/api/activities/${activity.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toneInstruks: tone }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSaveState("saved");
      onChanged();
      setTimeout(() => setSaveState("idle"), 2000);
    } catch {
      setSaveState("error");
    }
  }

  return (
    <section class="activity-sheet" data-testid="activity-detail">
      <div class="sheet-head">
        <div>
          <h2 data-testid="activity-title">{activity.title}</h2>
          <div class="activity-meta" data-testid="activity-meta">
            {TYPE_LABEL[activity.type]} · {daShort(activity.periodStart)}–{daShort(activity.periodEnd)}
            {activity.channels?.length ? ` · ${activity.channels.join(" + ")}` : ""}
          </div>
        </div>
        <button
          type="button"
          class="sheet-close"
          data-testid="activity-close"
          onClick={onClose}
          aria-label="Luk"
        >
          ✕
        </button>
      </div>

      <div class="activity-body">
        {/* periode-minical */}
        <div class="minical" data-testid="activity-minical">
          {MONTHS.map((m, i) => {
            const inPeriod = i >= startMonth && i <= endMonth;
            const isWindow = i === windowMonth && !inPeriod;
            const cls = ["m", inPeriod ? "on" : "", isWindow ? "gen" : ""].filter(Boolean).join(" ");
            return (
              <span key={m} class={cls} data-testid={`activity-month-${i}`}>
                {m}
              </span>
            );
          })}
        </div>
        <p class="legend" data-testid="activity-legend">
          <i class="lg-period" />
          kampagne-periode
          <i class="lg-window" />
          produktions-vindue (2 uger før — pipelinen fylder selv op)
        </p>

        <div class="activity-cols">
          <div class="activity-block">
            <h4>Tema &amp; tone-instruks til generatoren</h4>
            <textarea
              class="tone-input"
              rows={4}
              data-testid="activity-tone-input"
              value={tone}
              placeholder="Fx: Konkret værdi, ingen discount-hype. Max 1 pristilbud per brand."
              onInput={(e) => setTone((e.target as HTMLTextAreaElement).value)}
            />
            <p class="activity-note">
              Din instruks vinder altid over AI'ens egne vinkler.
            </p>
            <dl class="activity-kv">
              <dt>Kadence</dt>
              <dd>
                {activity.cadencePerBrand} stories pr. brand ({coverage.length} i alt)
              </dd>
            </dl>
          </div>

          <div class="activity-block">
            <h4>Dækning — {coverage.length} stories i denne aktivitet</h4>
            <div class="coverage" data-testid="activity-coverage">
              {coverage.length === 0 ? (
                <p class="activity-note" data-testid="activity-coverage-empty">
                  Ingen aktive brands valgt endnu.
                </p>
              ) : (
                coverage.map((c, i) => (
                  <div class="cov-row" data-testid="activity-coverage-row" key={`${c.brand}-${i}`}>
                    <span class="cov-thumb" />
                    <div>
                      {activity.title} — {c.brand}
                      <small>#{c.idx}</small>
                    </div>
                    <span class="cov-chip">VENTER PÅ VINDUE</span>
                  </div>
                ))
              )}
            </div>
            <p class="activity-note">
              Stories genereres automatisk i produktions-vinduet (F013.2) og dukker op i kalenderen som udkast.
            </p>
          </div>
        </div>
      </div>

      <div class="activity-actions">
        <button
          type="button"
          class="btn-primary"
          data-testid="activity-save"
          disabled={saveState === "saving"}
          onClick={save}
        >
          {saveState === "saving" ? "Gemmer…" : "Gem ændringer"}
        </button>
        {saveState === "saved" && (
          <span class="save-confirm" data-testid="activity-save-confirm">
            Gemt ✓
          </span>
        )}
        {saveState === "error" && (
          <span class="save-error" data-testid="activity-save-error">
            Kunne ikke gemme
          </span>
        )}
      </div>
    </section>
  );
}

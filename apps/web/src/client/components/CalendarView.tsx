import { useEffect, useMemo, useState } from "preact/hooks";
import type { Post } from "./QueueBoard";

export type CalendarPost = Post & { thumbUrl: string | null };

type Brand = { id: string; name: string };

const DOW = ["man", "tir", "ons", "tor", "fre", "lør", "søn"];

// Brandfarve efter position i brand-listen (jf. godkendt dashboard-mockup:
// hvert brand har sit farvespor i kalenderen)
const BRAND_CLASSES = ["brand-c0", "brand-c1", "brand-c2", "brand-c3"];

function currentMonth(): string {
  return new Date().toLocaleDateString("sv-SE").slice(0, 7);
}

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const label = new Date(y, m - 1, 1).toLocaleDateString("da-DK", {
    month: "long",
    year: "numeric",
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

const PLATFORM_LABELS: Array<[keyof Post, string]> = [
  ["linkedinText", "LI"],
  ["instagramText", "IG"],
  ["facebookText", "FB"],
];

export function CalendarView({
  onOpen,
  refreshKey,
}: {
  onOpen?: (post: Post) => void;
  refreshKey?: number;
}) {
  const [month, setMonth] = useState(currentMonth);
  const [days, setDays] = useState<Record<string, CalendarPost[]>>({});
  const [brands, setBrands] = useState<Brand[]>([]);
  const [activeBrandId, setActiveBrandId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/brands")
      .then((r) => r.json())
      .then(({ brands }: { brands: Brand[] }) => setBrands(brands));
  }, []);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/calendar?month=${month}`)
      .then((r) => r.json())
      .then(({ days }: { days: Record<string, CalendarPost[]> }) =>
        setDays(days ?? {}),
      )
      .finally(() => setLoading(false));
  }, [month, refreshKey]);

  const brandClass = useMemo(() => {
    const map = new Map<string, string>();
    brands.forEach((b, i) =>
      map.set(b.id, BRAND_CLASSES[i % BRAND_CLASSES.length]),
    );
    return map;
  }, [brands]);

  // Mandag-først-grid: blanke celler før d. 1., derefter månedens dage
  const cells = useMemo(() => {
    const [y, m] = month.split("-").map(Number);
    const leading = (new Date(y, m - 1, 1).getDay() + 6) % 7;
    const daysInMonth = new Date(y, m, 0).getDate();
    return [
      ...Array.from({ length: leading }, () => null),
      ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
    ];
  }, [month]);

  return (
    <section class="calendar" data-testid="calendar-root">
      <header class="calendar-head">
        <h2 data-testid="calendar-month-label">{monthLabel(month)}</h2>
        <div class="calendar-nav">
          <button
            type="button"
            class="btn-secondary calendar-nav-btn"
            data-testid="calendar-prev-month"
            onClick={() => setMonth((m) => shiftMonth(m, -1))}
          >
            ‹
          </button>
          <button
            type="button"
            class="btn-secondary calendar-nav-btn"
            data-testid="calendar-next-month"
            onClick={() => setMonth((m) => shiftMonth(m, 1))}
          >
            ›
          </button>
        </div>
        <div class="brand-picker calendar-pills">
          <button
            type="button"
            class={activeBrandId === null ? "brand-pill active" : "brand-pill"}
            data-testid="calendar-pill-all"
            onClick={() => setActiveBrandId(null)}
          >
            Alle brands
          </button>
          {brands.map((b) => (
            <button
              key={b.id}
              type="button"
              class={activeBrandId === b.id ? "brand-pill active" : "brand-pill"}
              data-testid={`calendar-pill-${b.id}`}
              onClick={() => setActiveBrandId(b.id)}
            >
              {b.name}
            </button>
          ))}
        </div>
      </header>

      {loading && <p class="queue-empty">Henter kalenderen…</p>}

      <div class="calendar-grid" data-testid="calendar-grid">
        {DOW.map((d) => (
          <span key={d} class="cal-dow">
            {d}
          </span>
        ))}
        {cells.map((day, i) => {
          if (day === null) return <div key={`blank-${i}`} class="cal-day dim" />;
          const key = `${month}-${String(day).padStart(2, "0")}`;
          const chips = (days[key] ?? []).filter(
            (p) => !activeBrandId || p.brandId === activeBrandId,
          );
          return (
            <div key={key} class="cal-day" data-testid={`calendar-day-${key}`}>
              <span class="cal-day-num">{day}</span>
              {chips.map((post) => (
                <button
                  key={post.id}
                  type="button"
                  class={`cal-chip ${brandClass.get(post.brandId) ?? "brand-c0"}`}
                  data-testid={`calendar-chip-${post.id}`}
                  title={post.headline}
                  onClick={() => onOpen?.(post)}
                >
                  {post.thumbUrl ? (
                    <img class="cal-chip-thumb" src={post.thumbUrl} alt="" />
                  ) : (
                    <span class="cal-chip-thumb placeholder" />
                  )}
                  <span class="cal-chip-title">{post.headline}</span>
                  <span class="cal-chip-meta">
                    {PLATFORM_LABELS.filter(([f]) => post[f])
                      .map(([, l]) => l)
                      .join("·")}
                  </span>
                </button>
              ))}
            </div>
          );
        })}
      </div>
    </section>
  );
}

import { useEffect, useState } from "preact/hooks";

// F013.1: årshjul-bånd — 12 måneder, lanes (kampagner / faste serier /
// lanceringer & mærkedage), events placeret som grid-column-spans i brandfarve,
// indeværende måned markeret. Jf. godkendt dashboard-mockup (.wheel/.lane/.act).

export type Activity = {
  id: string;
  title: string;
  type: "kampagne" | "serie" | "lancering" | "maerkedag";
  periodStart: string;
  periodEnd: string;
  brandIds: string[] | null;
  channels: string[] | null;
  cadencePerBrand: number;
  toneInstruks: string | null;
  generatePolicy: "auto" | "manual";
};

const MONTHS = ["jan", "feb", "mar", "apr", "maj", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];

// Lanes: kampagne · serie · lancering+maerkedag (jf. mockup)
const LANES: Array<{ label: string; types: Activity["type"][] }> = [
  { label: "Kampagner", types: ["kampagne"] },
  { label: "Faste serier (genereres automatisk)", types: ["serie"] },
  { label: "Lanceringer & mærkedage", types: ["lancering", "maerkedag"] },
];

// Stabil brandfarve fra id-hash (brands er dynamiske; mockuppen farver per brand)
function brandHue(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 360;
  return h;
}
function eventColor(a: Activity): string {
  if (a.type === "kampagne") return "oklch(0.45 0.12 25)";
  if (a.type === "maerkedag") return "oklch(0.5 0.12 300)";
  if (a.brandIds && a.brandIds.length === 1) {
    return `oklch(0.55 0.11 ${brandHue(a.brandIds[0])})`;
  }
  return a.type === "serie" ? "oklch(0.65 0.06 65)" : "var(--primary)";
}

function monthColumn(iso: string, edge: "start" | "end"): number {
  const d = new Date(iso);
  const m = d.getMonth() + 1; // 1-12
  return edge === "start" ? m : m + 1; // grid-column er 1-13
}

export function YearWheel({
  year,
  refreshKey,
  onOpen,
}: {
  year: number;
  refreshKey?: number;
  onOpen: (a: Activity) => void;
}) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const nowMonth = new Date().getMonth(); // 0-11

  useEffect(() => {
    fetch("/api/activities")
      .then((r) => r.json())
      .then(({ activities }: { activities: Activity[] }) => setActivities(activities))
      .catch(() => setActivities([]));
  }, [refreshKey]);

  // kun aktiviteter der overlapper det viste år
  const inYear = activities.filter((a) => {
    const s = new Date(a.periodStart).getFullYear();
    const e = new Date(a.periodEnd).getFullYear();
    return s <= year && e >= year;
  });

  return (
    <section class="wheel" data-testid="year-wheel">
      <h2>Årshjul {year} — al online marketing, alle brands</h2>
      <div class="months" data-testid="wheel-months">
        {MONTHS.map((m, i) => (
          <span key={m} class={i === nowMonth ? "now" : undefined} data-testid={`wheel-month-${i}`}>
            {m}
          </span>
        ))}
      </div>

      {LANES.map((lane) => {
        const events = inYear.filter((a) => lane.types.includes(a.type));
        return (
          <div class="lane" data-testid={`wheel-lane-${lane.types[0]}`} key={lane.label}>
            <div class="label">{lane.label}</div>
            {events.length === 0 ? (
              <div class="act-empty" data-testid="wheel-lane-empty">
                —
              </div>
            ) : (
              events.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  class="act"
                  data-testid={`wheel-event-${a.id}`}
                  title={a.title}
                  style={{
                    gridColumn: `${monthColumn(a.periodStart, "start")}/${monthColumn(a.periodEnd, "end")}`,
                    background: eventColor(a),
                  }}
                  onClick={() => onOpen(a)}
                >
                  {a.title}
                </button>
              ))
            )}
          </div>
        );
      })}
    </section>
  );
}

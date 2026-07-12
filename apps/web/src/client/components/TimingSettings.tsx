import { useEffect, useState } from "preact/hooks";

// F013.3: Timing & mærkedage jf. godkendt timing-mockup — tidsvinduer per
// platform (uge-grid, ★ bedste slot) + mærkedage i to spalter (undgå/udnyt,
// AUTO helligdage + EGEN). Ingen native controls.

type Window = {
  platform: string;
  weekdays: number[];
  bestWeekday: number | null;
  startMin: number;
  endMin: number;
};
type CalDay = { date: string; title: string; kind: "avoid" | "use"; source: "auto" | "egen"; id?: string };

// mockup-rækkefølge: man…søn
const WEEK = [
  { i: 1, l: "man" },
  { i: 2, l: "tir" },
  { i: 3, l: "ons" },
  { i: 4, l: "tor" },
  { i: 5, l: "fre" },
  { i: 6, l: "lør" },
  { i: 0, l: "søn" },
];
const PLATFORM_LABEL: Record<string, string> = {
  linkedin: "LinkedIn",
  instagram: "Instagram",
  facebook: "Facebook",
  newsletter: "Nyhedsbrev",
};

function hhmm(min: number) {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}

export function TimingSettings() {
  const [windows, setWindows] = useState<Window[]>([]);
  const [days, setDays] = useState<CalDay[]>([]);
  const [newDay, setNewDay] = useState({ title: "", kind: "avoid" as "avoid" | "use", month: 1, day: 1 });
  const [addState, setAddState] = useState<"idle" | "saving" | "error">("idle");
  const year = new Date().getFullYear();

  function loadWindows() {
    fetch("/api/timing/windows")
      .then((r) => r.json())
      .then((d) => setWindows(d.windows ?? []));
  }
  function loadDays() {
    fetch(`/api/timing/calendar?year=${year}`)
      .then((r) => r.json())
      .then((d) => setDays(d.days ?? []));
  }
  useEffect(() => {
    loadWindows();
    loadDays();
  }, []);

  async function toggleWeekday(w: Window, weekday: number) {
    const has = w.weekdays.includes(weekday);
    const weekdays = has ? w.weekdays.filter((x) => x !== weekday) : [...w.weekdays, weekday].sort();
    setWindows((all) => all.map((x) => (x.platform === w.platform ? { ...x, weekdays } : x)));
    await fetch("/api/timing/windows", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...w, weekdays }),
    });
  }

  async function addDay() {
    if (!newDay.title.trim()) return;
    setAddState("saving");
    try {
      const res = await fetch("/api/timing/markers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newDay),
      });
      if (!res.ok) throw new Error();
      setNewDay({ title: "", kind: newDay.kind, month: 1, day: 1 });
      setAddState("idle");
      loadDays();
    } catch {
      setAddState("error");
    }
  }

  async function deleteDay(id: string) {
    await fetch(`/api/timing/markers/${id}`, { method: "DELETE" });
    loadDays();
  }

  const avoid = days.filter((d) => d.kind === "avoid").sort((a, b) => a.date.localeCompare(b.date));
  const use = days.filter((d) => d.kind === "use").sort((a, b) => a.date.localeCompare(b.date));

  return (
    <section class="timing-settings" data-testid="timing-settings">
      <div class="timing-section">
        <h2>Tidsvinduer — hvornår på dagen, hvilke dage</h2>
        <p class="timing-sub">
          Hver platform har sine gode tidsrum. Kalenderen planlægger kun ind i åbne felter, ★ er
          bedste slot — og "tid til at poste"-beskeden lander ved vinduets start.
        </p>
        <div class="timing-panel" data-testid="timing-windows">
          {windows.map((w) => (
            <div class="winrow" data-testid={`window-${w.platform}`} key={w.platform}>
              <div class="winplat">
                {PLATFORM_LABEL[w.platform] ?? w.platform}
                <small>
                  {hhmm(w.startMin)}–{hhmm(w.endMin)}
                </small>
              </div>
              <div class="winweek">
                {WEEK.map((d) => {
                  const on = w.weekdays.includes(d.i);
                  const best = w.bestWeekday === d.i;
                  return (
                    <button
                      key={d.i}
                      type="button"
                      class={`winslot${on ? " on" : ""}${best ? " best" : ""}`}
                      data-testid={`window-${w.platform}-${d.i}`}
                      aria-pressed={on}
                      title={d.l}
                      onClick={() => toggleWeekday(w, d.i)}
                    >
                      {best ? "★" : ""}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div class="timing-section">
        <h2>Mærkedage — undgå eller udnyt</h2>
        <p class="timing-sub">
          Den danske helligdagskalender er indbygget (AUTO) — den skal du aldrig vedligeholde. Dine
          egne (EGEN) lægger du selv til. Undgå-dage blokerer planlægning; udnyt-dage trækker en
          tematiseret ekstra-story.
        </p>
        <div class="timing-cols">
          <div class="timing-panel" data-testid="marker-avoid">
            <h3 class="h-avoid">⛔ Undgå at poste</h3>
            {avoid.map((d) => (
              <div class="dayrow" data-testid="marker-row" key={d.date + d.title}>
                <span class="dayrow-date">{d.date.slice(5)}</span>
                <div>{d.title}</div>
                {d.source === "auto" ? (
                  <span class="marker-chip auto">AUTO</span>
                ) : (
                  <>
                    <span class="marker-chip">EGEN</span>
                    <button
                      type="button"
                      class="marker-del"
                      data-testid={`marker-del-${d.id}`}
                      onClick={() => d.id && deleteDay(d.id)}
                      aria-label="Slet"
                    >
                      ✕
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
          <div class="timing-panel" data-testid="marker-use">
            <h3 class="h-use">✦ Udnyt dagen</h3>
            {use.map((d) => (
              <div class="dayrow" data-testid="marker-row" key={d.date + d.title}>
                <span class="dayrow-date">{d.date.slice(5)}</span>
                <div>{d.title}</div>
                {d.source === "auto" ? (
                  <span class="marker-chip auto">AUTO</span>
                ) : (
                  <>
                    <span class="marker-chip">EGEN</span>
                    <button
                      type="button"
                      class="marker-del"
                      data-testid={`marker-del-${d.id}`}
                      onClick={() => d.id && deleteDay(d.id)}
                      aria-label="Slet"
                    >
                      ✕
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>

        <form
          class="marker-add"
          data-testid="marker-add-form"
          onSubmit={(e) => {
            e.preventDefault();
            addDay();
          }}
        >
          <div class="marker-kind-toggle">
            <button
              type="button"
              class={`kind-pill${newDay.kind === "avoid" ? " active" : ""}`}
              data-testid="marker-kind-avoid"
              onClick={() => setNewDay({ ...newDay, kind: "avoid" })}
            >
              Undgå
            </button>
            <button
              type="button"
              class={`kind-pill${newDay.kind === "use" ? " active" : ""}`}
              data-testid="marker-kind-use"
              onClick={() => setNewDay({ ...newDay, kind: "use" })}
            >
              Udnyt
            </button>
          </div>
          <input
            type="text"
            placeholder="Mærkedagens navn"
            data-testid="marker-title"
            value={newDay.title}
            onInput={(e) => setNewDay({ ...newDay, title: (e.target as HTMLInputElement).value })}
          />
          <input
            type="number"
            min={1}
            max={12}
            placeholder="md"
            data-testid="marker-month"
            value={newDay.month}
            onInput={(e) => setNewDay({ ...newDay, month: Number((e.target as HTMLInputElement).value) || 1 })}
          />
          <input
            type="number"
            min={1}
            max={31}
            placeholder="dag"
            data-testid="marker-day"
            value={newDay.day}
            onInput={(e) => setNewDay({ ...newDay, day: Number((e.target as HTMLInputElement).value) || 1 })}
          />
          <button
            type="submit"
            class="btn-primary"
            data-testid="marker-add-submit"
            disabled={addState === "saving" || !newDay.title.trim()}
          >
            {addState === "saving" ? "Tilføjer…" : "Tilføj mærkedag"}
          </button>
          {addState === "error" && <span class="save-error">Kunne ikke tilføje</span>}
        </form>
      </div>
    </section>
  );
}

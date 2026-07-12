import { avoidDateSet, danishHolidays } from "./holidays";
import { isOpenWeekday, windowStartMin, type Window } from "./windows";

// F013.3: flyt en foreslået dato væk fra undgå-dage til nærmeste gyldige dag i
// platform-vinduet, med synlig begrundelse. Brugt af cron ved planlægning.

export type MarkerDay = {
  kind: "avoid" | "use";
  month: number;
  day: number;
  brandId: string | null;
  title: string;
};

const DAY_MS = 86400000;
const isoOf = (d: Date) =>
  `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;

export class TimingContext {
  private holidayByYear = new Map<number, Set<string>>();
  private holidayTitleByYear = new Map<number, Map<string, string>>();
  constructor(private markers: MarkerDay[]) {}

  private holidays(year: number): Set<string> {
    let s = this.holidayByYear.get(year);
    if (!s) {
      s = avoidDateSet(year);
      this.holidayByYear.set(year, s);
    }
    return s;
  }
  private holidayTitle(year: number): Map<string, string> {
    let m = this.holidayTitleByYear.get(year);
    if (!m) {
      m = new Map(danishHolidays(year).filter((h) => h.kind === "avoid").map((h) => [h.date, h.title]));
      this.holidayTitleByYear.set(year, m);
    }
    return m;
  }

  /** Er datoen en undgå-dag for brandet? Returnerer titlen hvis ja. */
  avoidTitle(date: Date, brandId: string): string | null {
    const y = date.getUTCFullYear();
    const key = isoOf(date);
    if (this.holidays(y).has(key)) return this.holidayTitle(y).get(key) ?? "Helligdag";
    const own = this.markers.find(
      (m) =>
        m.kind === "avoid" &&
        m.month === date.getUTCMonth() + 1 &&
        m.day === date.getUTCDate() &&
        (m.brandId === null || m.brandId === brandId),
    );
    return own ? own.title : null;
  }

  /** Udnyt-dage for et brand i et datointerval (auto Black Friday/Cyber Monday + egne). */
  useDaysBetween(brandId: string, from: Date, to: Date): Array<{ date: Date; title: string }> {
    const out: Array<{ date: Date; title: string }> = [];
    for (let y = from.getUTCFullYear(); y <= to.getUTCFullYear(); y++) {
      for (const h of danishHolidays(y).filter((d) => d.kind === "use")) {
        const d = new Date(h.date + "T00:00:00Z");
        if (d >= from && d <= to) out.push({ date: d, title: h.title });
      }
    }
    for (const m of this.markers.filter((m) => m.kind === "use" && (m.brandId === null || m.brandId === brandId))) {
      for (let y = from.getUTCFullYear(); y <= to.getUTCFullYear(); y++) {
        const d = new Date(Date.UTC(y, m.month - 1, m.day));
        if (d >= from && d <= to) out.push({ date: d, title: m.title });
      }
    }
    return out;
  }
}

/**
 * Flyt en foreslået dato til nærmeste gyldige dag: åben ugedag i platform-
 * vinduet OG ikke en undgå-dag. Sætter tidspunktet til vinduets start.
 * Returnerer flytte-begrundelse hvis den oprindelige dato var en undgå-dag.
 */
export function resolveScheduleDate(
  proposed: Date,
  brandId: string,
  platforms: string[] | null,
  windows: Window[],
  ctx: TimingContext,
): { date: Date; movedFrom: Date | null; movedReason: string | null } {
  const original = new Date(proposed);
  const originalAvoid = ctx.avoidTitle(original, brandId);
  let date = new Date(proposed);
  for (let guard = 0; guard < 60; guard++) {
    const blocked = ctx.avoidTitle(date, brandId) !== null || !isOpenWeekday(windows, platforms, date.getUTCDay());
    if (!blocked) break;
    date = new Date(date.getTime() + DAY_MS);
  }
  // Sæt tidspunktet til vinduets start (AC2: notify følger vinduet)
  const startMin = windowStartMin(windows, platforms);
  date.setUTCHours(Math.floor(startMin / 60), startMin % 60, 0, 0);

  if (date.getUTCDate() !== original.getUTCDate() && originalAvoid) {
    const fmt = original.toLocaleDateString("da-DK", { day: "numeric", month: "short" });
    return { date, movedFrom: original, movedReason: `flyttet fra ${fmt} (${originalAvoid})` };
  }
  return { date, movedFrom: null, movedReason: null };
}

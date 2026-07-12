// F013.3: dansk helligdagskalender — beregnet indbygget, ingen vedligehold og
// ingen ekstern API. Påske-afledte dage kommer fra Meeus/Jones/Butcher-formlen.

export type MarkerKind = "avoid" | "use";
export type CalendarDay = {
  date: string; // YYYY-MM-DD
  title: string;
  kind: MarkerKind;
  source: "auto" | "egen";
};

function iso(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Påskesøndag for et år (Anonymous Gregorian / Meeus-Jones-Butcher). */
function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31); // 3=marts, 4=april
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

function addUtcDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * 86400000);
}
function isoOf(d: Date): string {
  return iso(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}
/** N'te ugedag i en måned (weekday 0=søn..6=lør, n 1-baseret). */
function nthWeekday(year: number, month: number, weekday: number, n: number): Date {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const offset = (weekday - first.getUTCDay() + 7) % 7;
  return new Date(Date.UTC(year, month - 1, 1 + offset + (n - 1) * 7));
}

/** Danske helligdage + auto-udnyt-dage for et år. */
export function danishHolidays(year: number): CalendarDay[] {
  const easter = easterSunday(year);
  const avoid: CalendarDay[] = [
    { date: iso(year, 1, 1), title: "Nytårsdag", kind: "avoid", source: "auto" },
    { date: isoOf(addUtcDays(easter, -3)), title: "Skærtorsdag", kind: "avoid", source: "auto" },
    { date: isoOf(addUtcDays(easter, -2)), title: "Langfredag", kind: "avoid", source: "auto" },
    { date: isoOf(easter), title: "Påskedag", kind: "avoid", source: "auto" },
    { date: isoOf(addUtcDays(easter, 1)), title: "2. påskedag", kind: "avoid", source: "auto" },
    { date: isoOf(addUtcDays(easter, 39)), title: "Kristi himmelfart", kind: "avoid", source: "auto" },
    { date: isoOf(addUtcDays(easter, 49)), title: "Pinsedag", kind: "avoid", source: "auto" },
    { date: isoOf(addUtcDays(easter, 50)), title: "2. pinsedag", kind: "avoid", source: "auto" },
    { date: iso(year, 6, 5), title: "Grundlovsdag", kind: "avoid", source: "auto" },
    { date: iso(year, 12, 24), title: "Juleaften", kind: "avoid", source: "auto" },
    { date: iso(year, 12, 25), title: "Juledag", kind: "avoid", source: "auto" },
    { date: iso(year, 12, 26), title: "2. juledag", kind: "avoid", source: "auto" },
    { date: iso(year, 12, 31), title: "Nytårsaften", kind: "avoid", source: "auto" },
  ];
  // Auto-udnyt: Black Friday (4. fredag i nov) + Cyber Monday (mandagen efter)
  const blackFriday = nthWeekday(year, 11, 5, 4);
  const use: CalendarDay[] = [
    { date: isoOf(blackFriday), title: "Black Friday", kind: "use", source: "auto" },
    { date: isoOf(addUtcDays(blackFriday, 3)), title: "Cyber Monday", kind: "use", source: "auto" },
  ];
  return [...avoid, ...use];
}

/** Sæt af undgå-datoer (auto-helligdage) for et år — hurtigt opslag. */
export function avoidDateSet(year: number): Set<string> {
  return new Set(danishHolidays(year).filter((h) => h.kind === "avoid").map((h) => h.date));
}

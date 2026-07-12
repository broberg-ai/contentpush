import { and, eq, isNull } from "drizzle-orm";
import { db, tables } from "../db";

// F013.3: tidsvindue-defaults fra godkendt timing-mockup. Ugedage: 0=søn..6=lør.
export type Window = {
  platform: string;
  weekdays: number[];
  bestWeekday: number | null;
  startMin: number;
  endMin: number;
};

export const DEFAULT_WINDOWS: Record<string, Omit<Window, "platform">> = {
  // LinkedIn: B2B, man–tor morgen, bedst tirsdag
  linkedin: { weekdays: [1, 2, 3, 4], bestWeekday: 2, startMin: 8 * 60, endMin: 10 * 60 },
  // Instagram: frokost + aften, bedst onsdag
  instagram: { weekdays: [1, 2, 3, 4, 5, 0], bestWeekday: 3, startMin: 11 * 60 + 30, endMin: 13 * 60 },
  // Facebook: aften + weekend, bedst søndag
  facebook: { weekdays: [3, 6, 0], bestWeekday: 0, startMin: 19 * 60, endMin: 21 * 60 },
  // Nyhedsbrev: sidste torsdag i måneden 10:00 (F015 producerer først senere)
  newsletter: { weekdays: [4], bestWeekday: 4, startMin: 10 * 60, endMin: 11 * 60 },
};

export function defaultWindows(): Window[] {
  return Object.entries(DEFAULT_WINDOWS).map(([platform, w]) => ({ platform, ...w }));
}

/**
 * Effektive tidsvinduer for et brand: brand-specifikke DB-vinduer, ellers
 * globale DB-vinduer, ellers mockup-defaults. Én kilde til "hvornår må vi poste".
 */
export async function resolveWindows(brandId: string | null): Promise<Window[]> {
  const rows = await db.select().from(tables.postingWindows);
  const forBrand = brandId ? rows.filter((r) => r.brandId === brandId) : [];
  const global = rows.filter((r) => r.brandId === null);
  const pick = (platform: string): Window => {
    const b = forBrand.find((r) => r.platform === platform);
    const g = global.find((r) => r.platform === platform);
    const src = b ?? g;
    if (src) {
      return {
        platform,
        weekdays: src.weekdays,
        bestWeekday: src.bestWeekday,
        startMin: src.startMin,
        endMin: src.endMin,
      };
    }
    return { platform, ...DEFAULT_WINDOWS[platform] };
  };
  return Object.keys(DEFAULT_WINDOWS).map(pick);
}

/** Er ugedagen åben i mindst ét af brandets platform-vinduer? */
export function isOpenWeekday(windows: Window[], platforms: string[] | null, weekday: number): boolean {
  const relevant = platforms?.length
    ? windows.filter((w) => platforms.includes(w.platform))
    : windows.filter((w) => w.platform !== "newsletter");
  const pool = relevant.length ? relevant : windows;
  return pool.some((w) => w.weekdays.includes(weekday));
}

/** Vinduets start-tidspunkt (minutter fra midnat) for den tidligste åbne platform. */
export function windowStartMin(windows: Window[], platforms: string[] | null): number {
  const relevant = platforms?.length
    ? windows.filter((w) => platforms.includes(w.platform))
    : windows.filter((w) => w.platform !== "newsletter");
  const pool = relevant.length ? relevant : windows;
  return Math.min(...pool.map((w) => w.startMin));
}

import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { media } from "./media";
import { db, tables } from "../db";

// F016.3 — kurateret musik-hylde. Starter-spor: Kevin MacLeod (incompetech.com,
// CC BY 4.0 — kreditering GEMMES pr. spor så juraen er ren). Christian kan tilføje
// egne no-attribution Pixabay-spor senere (samme model, credit=null).
const BASE = "https://incompetech.com/music/royalty-free/mp3-royaltyfree/";
const SEED = [
  { title: "Carefree", mood: "Let & positiv", file: "Carefree.mp3" },
  { title: "Inspired", mood: "Opløftende", file: "Inspired.mp3" },
  { title: "Enchanted Journey", mood: "Filmisk & varm", file: "Enchanted Journey.mp3" },
  { title: "Local Forecast - Elevator", mood: "Neutral & professionel", file: "Local Forecast - Elevator.mp3" },
  { title: "Wallpaper", mood: "Rolig baggrund", file: "Wallpaper.mp3" },
  { title: "Feelin Good", mood: "Glad & energisk", file: "Feelin Good.mp3" },
  { title: "Sneaky Snitch", mood: "Legende & let", file: "Sneaky Snitch.mp3" },
];

async function probeDurationSec(bytes: Uint8Array): Promise<number | null> {
  const dir = await mkdtemp(join(tmpdir(), "cp-probe-"));
  const p = join(dir, "a.mp3");
  await writeFile(p, bytes);
  try {
    const out = await new Promise<string>((resolve, reject) => {
      const proc = spawn("ffprobe", [
        "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", p,
      ]);
      let o = "";
      proc.stdout.on("data", (d) => (o += d.toString()));
      proc.on("error", reject);
      proc.on("close", () => resolve(o));
    });
    const n = parseFloat(out.trim());
    return Number.isFinite(n) ? Math.round(n) : null;
  } catch {
    return null;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/** Idempotent seed af starter-hylden (henter incompetech → R2 → music_tracks). */
export async function seedMusicShelf(): Promise<{ added: number; skipped: number; failed: string[] }> {
  if (!media) throw new Error("Media-storage ikke konfigureret (ship-dark)");
  let added = 0;
  let skipped = 0;
  const failed: string[] = [];
  for (const s of SEED) {
    const existing = await db
      .select({ id: tables.musicTracks.id })
      .from(tables.musicTracks)
      .where(eq(tables.musicTracks.title, s.title));
    if (existing.length > 0) {
      skipped++;
      continue;
    }
    try {
      const res = await fetch(BASE + encodeURIComponent(s.file), {
        headers: { "User-Agent": "Mozilla/5.0" },
      });
      if (!res.ok) {
        failed.push(s.title);
        continue;
      }
      const bytes = new Uint8Array(await res.arrayBuffer());
      if (bytes.length < 50000) {
        failed.push(s.title);
        continue;
      }
      const key = `music/${crypto.randomUUID()}.mp3`;
      await media.upload(key, bytes, { contentType: "audio/mpeg" });
      const durationSec = await probeDurationSec(bytes);
      await db.insert(tables.musicTracks).values({
        title: s.title,
        mood: s.mood,
        url: key,
        durationSec,
        credit: `Musik: "${s.title}" af Kevin MacLeod (incompetech.com) — CC BY 4.0`,
      });
      added++;
    } catch {
      failed.push(s.title);
    }
  }
  return { added, skipped, failed };
}

export interface MusicTrackDto {
  id: string;
  title: string;
  mood: string | null;
  durationSec: number | null;
  credit: string | null;
  url: string | null;
}

/** Hylden med signerede preview-URL'er. */
export async function listMusicTracks(): Promise<MusicTrackDto[]> {
  const rows = await db.select().from(tables.musicTracks);
  const out: MusicTrackDto[] = [];
  for (const r of rows) {
    out.push({
      id: r.id,
      title: r.title,
      mood: r.mood,
      durationSec: r.durationSec,
      credit: r.credit,
      url: media ? await media.signedUrl(r.url) : null,
    });
  }
  return out;
}

/** Rå bytes for et spor (til mixning i compile). */
export async function musicTrackBytes(trackId: string): Promise<Uint8Array | null> {
  if (!media) return null;
  const [t] = await db
    .select()
    .from(tables.musicTracks)
    .where(eq(tables.musicTracks.id, trackId));
  if (!t) return null;
  const url = await media.signedUrl(t.url);
  const res = await fetch(url);
  if (!res.ok) return null;
  return new Uint8Array(await res.arrayBuffer());
}

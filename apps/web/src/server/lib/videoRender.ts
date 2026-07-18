import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";

// F014.1 — "skabelon-animation": deterministisk still → kort mp4 (Ken Burns-
// zoom + on-brand tekst der fader ind). Dette er DEN tynde søm components
// blessede til spiken (intercom 17794): al ffmpeg-brug er indkapslet HER i ét
// modul — ikke spredt — så den kan løftes rent til @broberg/video-render når
// consumer #2 melder sig (rule-of-three; gap tracked som cardmem-idé 019f6ffb).
// Tekst rasteriseres via sharp (SVG→PNG) fordi denne ffmpeg-build mangler
// drawtext/freetype — og SVG-serif matcher @broberg/theme bedre alligevel.

export type Aspect = "16:9" | "9:16";

export interface TemplateAnimationInput {
  /** Still-billedets rå bytes (jpg/png/webp). */
  imageBytes: Uint8Array;
  /** Overskrift (stor serif). */
  headline: string;
  /** Underlinje (brand/afsender), valgfri. */
  subtitle?: string;
  aspect: Aspect;
  /** Kliplængde i sekunder (default 8). */
  durationSec?: number;
}

export interface TemplateAnimationResult {
  /** Den færdige mp4 som bytes (h264/yuv420p, faststart). */
  bytes: Uint8Array;
  mimeType: "video/mp4";
  width: number;
  height: number;
  durationSec: number;
  /** Render-tid (wall-clock sekunder) — bruges i spikens evidens. */
  renderSec: number;
}

const DIMS: Record<Aspect, { w: number; h: number }> = {
  "16:9": { w: 1280, h: 720 },
  "9:16": { w: 720, h: 1280 },
};

const FPS = 30;

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Fuld-frame transparent overlay: mørkt lower-third-bånd + on-brand serif-tekst. */
async function renderTextOverlay(
  w: number,
  h: number,
  headline: string,
  subtitle: string | undefined,
): Promise<Buffer> {
  const base = Math.min(w, h);
  const margin = Math.round(w * 0.055);
  const bandH = Math.round(base * 0.3);
  const hlSize = Math.round(base * 0.072);
  const subSize = Math.round(base * 0.038);
  const bandY = h - bandH;
  const hlY = subtitle ? h - Math.round(bandH * 0.42) : h - Math.round(bandH * 0.34);
  const subY = h - Math.round(bandH * 0.16);

  const subLine = subtitle
    ? `<text x="${margin}" y="${subY}" font-family="Georgia, 'Times New Roman', serif" font-size="${subSize}" fill="#D9C9B3">${escapeXml(subtitle)}</text>`
    : "";

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
  <defs>
    <linearGradient id="band" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="rgba(20,14,10,0)"/>
      <stop offset="0.35" stop-color="rgba(20,14,10,0.55)"/>
      <stop offset="1" stop-color="rgba(20,14,10,0.82)"/>
    </linearGradient>
  </defs>
  <rect x="0" y="${bandY}" width="${w}" height="${bandH}" fill="url(#band)"/>
  <text x="${margin}" y="${hlY}" font-family="Georgia, 'Times New Roman', serif" font-size="${hlSize}" font-weight="700" fill="#F5EFE6">${escapeXml(headline)}</text>
  ${subLine}
</svg>`;

  return sharp(Buffer.from(svg)).png().toBuffer();
}

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn("ffmpeg", args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    proc.stderr.on("data", (d) => {
      stderr += d.toString();
    });
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exit ${code}: ${stderr.slice(-800)}`));
    });
  });
}

/**
 * Renderer én skabelon-animation (still + tekst + Ken Burns) til mp4.
 * Deterministisk, ~$0 (lokal CPU). Kaster ved ffmpeg-fejl.
 */
export async function renderTemplateAnimation(
  input: TemplateAnimationInput,
): Promise<TemplateAnimationResult> {
  const { w, h } = DIMS[input.aspect];
  const duration = input.durationSec ?? 8;
  const frames = Math.round(duration * FPS);
  const t0 = Date.now();

  const dir = await mkdtemp(join(tmpdir(), "cp-vidrender-"));
  const stillPath = join(dir, "still");
  const textPath = join(dir, "text.png");
  const outPath = join(dir, "out.mp4");

  try {
    await writeFile(stillPath, input.imageBytes);
    await writeFile(textPath, await renderTextOverlay(w, h, input.headline, input.subtitle));

    // Zoompan har brug for opskaleret headroom for at undgå jitter → 2× target.
    const preW = w * 2;
    const preH = h * 2;
    const zoomMax = 1.1;
    const zoomRate = (zoomMax - 1) / frames;

    const filter = [
      `[0:v]scale=${preW}:${preH}:force_original_aspect_ratio=increase,crop=${preW}:${preH},` +
        `zoompan=z='min(zoom+${zoomRate.toFixed(6)},${zoomMax})':d=${frames}:` +
        `x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${w}x${h}:fps=${FPS},` +
        `fade=t=in:st=0:d=0.5,fade=t=out:st=${(duration - 0.5).toFixed(2)}:d=0.5[bg]`,
      `[1:v]format=rgba,fade=t=in:st=0.7:d=1.0:alpha=1[txt]`,
      `[bg][txt]overlay=0:0[v]`,
    ].join(";");

    await runFfmpeg([
      "-y",
      "-loop", "1", "-t", String(duration), "-i", stillPath,
      "-loop", "1", "-t", String(duration), "-i", textPath,
      "-filter_complex", filter,
      "-map", "[v]",
      "-c:v", "libx264",
      "-pix_fmt", "yuv420p",
      "-r", String(FPS),
      "-crf", "20",
      "-preset", "medium",
      "-movflags", "+faststart",
      "-an",
      "-t", String(duration),
      outPath,
    ]);

    const bytes = new Uint8Array(await readFile(outPath));
    return {
      bytes,
      mimeType: "video/mp4",
      width: w,
      height: h,
      durationSec: duration,
      renderSec: (Date.now() - t0) / 1000,
    };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

// ── F016.2: drejebog-kompilering (samme indkapslede ffmpeg-søm) ────────────

/**
 * Rasteriserer et tekst-kort (fuld-frame farvet baggrund + centreret serif-
 * tekst) til PNG-bytes — bruges til logo-scener og ui-capture-placeholders.
 */
export async function renderCardImage(input: {
  title: string;
  subtitle?: string;
  aspect: Aspect;
}): Promise<Uint8Array> {
  const { w, h } = DIMS[input.aspect];
  const base = Math.min(w, h);
  const titleSize = Math.round(base * 0.09);
  const subSize = Math.round(base * 0.04);
  const cx = Math.round(w / 2);
  const cy = Math.round(h / 2);
  const sub = input.subtitle
    ? `<text x="${cx}" y="${cy + Math.round(base * 0.09)}" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="${subSize}" fill="#D9C9B3">${escapeXml(input.subtitle)}</text>`
    : "";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
  <rect width="${w}" height="${h}" fill="#2a2018"/>
  <text x="${cx}" y="${cy}" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="${titleSize}" font-weight="700" fill="#F5EFE6">${escapeXml(input.title)}</text>
  ${sub}
</svg>`;
  return new Uint8Array(await sharp(Buffer.from(svg)).png().toBuffer());
}

/**
 * Ken Burns-klip af vilkårlig varighed fra et still, med valgfri caption i
 * lower-third (onScreenText). Ingen tekst-bånd hvis caption mangler.
 */
export async function renderStillClip(input: {
  imageBytes: Uint8Array;
  aspect: Aspect;
  durationSec: number;
  caption?: string;
}): Promise<Uint8Array> {
  const { w, h } = DIMS[input.aspect];
  const duration = Math.max(1, input.durationSec);
  const frames = Math.round(duration * FPS);
  const dir = await mkdtemp(join(tmpdir(), "cp-stillclip-"));
  const stillPath = join(dir, "still");
  const textPath = join(dir, "text.png");
  const outPath = join(dir, "out.mp4");
  try {
    await writeFile(stillPath, input.imageBytes);
    const preW = w * 2;
    const preH = h * 2;
    const zoomMax = 1.1;
    const zoomRate = (zoomMax - 1) / frames;
    const kb =
      `[0:v]scale=${preW}:${preH}:force_original_aspect_ratio=increase,crop=${preW}:${preH},` +
      `zoompan=z='min(zoom+${zoomRate.toFixed(6)},${zoomMax})':d=${frames}:` +
      `x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${w}x${h}:fps=${FPS},` +
      `fade=t=in:st=0:d=0.4,fade=t=out:st=${(duration - 0.4).toFixed(2)}:d=0.4`;

    const inputs = ["-y", "-loop", "1", "-t", String(duration), "-i", stillPath];
    let filter: string;
    if (input.caption && input.caption.trim()) {
      await writeFile(textPath, await renderTextOverlay(w, h, input.caption, undefined));
      inputs.push("-loop", "1", "-t", String(duration), "-i", textPath);
      filter =
        `${kb}[bg];[1:v]format=rgba,fade=t=in:st=0.5:d=0.8:alpha=1[txt];[bg][txt]overlay=0:0[v]`;
    } else {
      filter = `${kb}[v]`;
    }

    await runFfmpeg([
      ...inputs,
      "-filter_complex", filter,
      "-map", "[v]",
      "-c:v", "libx264",
      "-pix_fmt", "yuv420p",
      "-r", String(FPS),
      "-crf", "20",
      "-preset", "medium",
      "-movflags", "+faststart",
      "-an",
      "-t", String(duration),
      outPath,
    ]);
    return new Uint8Array(await readFile(outPath));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/**
 * Samler N scene-klip (evt. forskellig opløsning: still-klip vs AI-klip) til
 * én mp4. Skalerer hvert input til drejebogens format, muxer et samlet
 * voiceover-lydspor hvis givet, og mixer et valgfrit baggrunds-musikspor (F016.3)
 * loopet + duckset (~15% volumen + fade) UNDER talen. Uden lyd = tavs video.
 */
export async function concatClips(input: {
  clips: Uint8Array[];
  aspect: Aspect;
  audio?: Uint8Array;
  music?: Uint8Array;
}): Promise<{ bytes: Uint8Array; durationSec: number; width: number; height: number }> {
  const { w, h } = DIMS[input.aspect];
  if (input.clips.length === 0) throw new Error("Ingen scene-klip at samle");
  const dir = await mkdtemp(join(tmpdir(), "cp-concat-"));
  const outPath = join(dir, "out.mp4");
  try {
    const clipPaths: string[] = [];
    for (let i = 0; i < input.clips.length; i++) {
      const p = join(dir, `clip${i}.mp4`);
      await writeFile(p, input.clips[i]);
      clipPaths.push(p);
    }
    const args: string[] = ["-y"];
    for (const p of clipPaths) args.push("-i", p);
    let voIdx = -1;
    let musIdx = -1;
    if (input.audio) {
      const ap = join(dir, "vo.mp3");
      await writeFile(ap, input.audio);
      args.push("-i", ap);
      voIdx = clipPaths.length;
    }
    if (input.music) {
      const mp = join(dir, "mus.mp3");
      await writeFile(mp, input.music);
      // -stream_loop -1: loop musikken så den dækker hele videoen (trimmes af -shortest)
      args.push("-stream_loop", "-1", "-i", mp);
      musIdx = clipPaths.length + (voIdx >= 0 ? 1 : 0);
    }
    // Normalisér hvert klip til target-format, saml, og (evt.) mux lyd
    const parts = clipPaths
      .map(
        (_, i) =>
          `[${i}:v]scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},setsar=1,fps=${FPS},format=yuv420p[v${i}]`,
      )
      .join(";");
    const concatIn = clipPaths.map((_, i) => `[v${i}]`).join("");
    let filter = `${parts};${concatIn}concat=n=${clipPaths.length}:v=1:a=0[v]`;

    // Lyd: VO + musik (mix, musik duckset) · kun VO · kun musik · ingen
    let audioMap: string | null = null;
    if (voIdx >= 0 && musIdx >= 0) {
      // normalize=0: SUMMÉR (ikke gennemsnit) → talen holder fuld volumen og
      // musikken lægges duckset UNDER (ellers halverer amix talen).
      filter +=
        `;[${voIdx}:a]volume=1.0[vo];` +
        `[${musIdx}:a]volume=0.12,afade=t=in:st=0:d=1.5[mus];` +
        `[vo][mus]amix=inputs=2:duration=first:dropout_transition=0:normalize=0[a]`;
      audioMap = "[a]";
    } else if (voIdx >= 0) {
      audioMap = `${voIdx}:a`;
    } else if (musIdx >= 0) {
      filter += `;[${musIdx}:a]volume=0.3,afade=t=in:st=0:d=1.5[a]`;
      audioMap = "[a]";
    }

    args.push("-filter_complex", filter, "-map", "[v]");
    if (audioMap) {
      args.push("-map", audioMap, "-c:a", "aac", "-b:a", "160k", "-shortest");
    } else {
      args.push("-an");
    }
    args.push(
      "-c:v", "libx264",
      "-pix_fmt", "yuv420p",
      "-r", String(FPS),
      "-crf", "20",
      "-preset", "medium",
      "-movflags", "+faststart",
      outPath,
    );
    await runFfmpeg(args);
    return { bytes: new Uint8Array(await readFile(outPath)), durationSec: 0, width: w, height: h };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/** Samler N lydspor (fx scene-voiceovers) til ét mp3-spor i rækkefølge. */
export async function concatAudio(tracks: Uint8Array[]): Promise<Uint8Array> {
  if (tracks.length === 0) throw new Error("Ingen lydspor at samle");
  const dir = await mkdtemp(join(tmpdir(), "cp-audio-"));
  const outPath = join(dir, "vo.mp3");
  try {
    const paths: string[] = [];
    for (let i = 0; i < tracks.length; i++) {
      const p = join(dir, `a${i}.mp3`);
      await writeFile(p, tracks[i]);
      paths.push(p);
    }
    const args: string[] = ["-y"];
    for (const p of paths) args.push("-i", p);
    const inrefs = paths.map((_, i) => `[${i}:a]`).join("");
    args.push(
      "-filter_complex", `${inrefs}concat=n=${paths.length}:v=0:a=1[a]`,
      "-map", "[a]",
      "-c:a", "libmp3lame",
      "-q:a", "3",
      outPath,
    );
    await runFfmpeg(args);
    return new Uint8Array(await readFile(outPath));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

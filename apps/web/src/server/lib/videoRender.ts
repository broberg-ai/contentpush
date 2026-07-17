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

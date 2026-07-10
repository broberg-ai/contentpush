import { execSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { redactSecrets } from "@broberg/secret-scan";

// F006.1: blokerende secret-gate. Kører @broberg/secret-scan (flådens
// kanoniske pattern-sæt) over ALLE git-sporede filer og fejler (exit 1) hvis
// en Discord-webhook, AI-nøgle el.lign. er committet. .env* er gitignored og
// dukker derfor aldrig op her. Ingen --no-verify-bypass: gaten er hele pointen.

const REPO_ROOT = execSync("git rev-parse --show-toplevel").toString().trim();

// Binære/genererede filer scannes ikke (lockfiles har høj-entropi-strenge der
// ikke er hemmeligheder; billeder er binære). Kildekode + config er i fokus.
const SKIP_EXT = new Set([
  ".png", ".jpg", ".jpeg", ".webp", ".gif", ".ico", ".pdf", ".woff", ".woff2",
  ".ttf", ".lock", ".map",
]);
const SKIP_FILE = new Set(["bun.lock", "package-lock.json", "pnpm-lock.yaml", "yarn.lock"]);
const MAX_BYTES = 1_000_000; // spring meget store filer over (data-dumps)

const NUL = String.fromCharCode(0);
function looksBinary(text: string): boolean {
  // NUL-byte inden for de første 8 KB = binær fil
  return text.slice(0, 8192).includes(NUL);
}

const tracked = execSync("git ls-files", { cwd: REPO_ROOT, maxBuffer: 64 * 1024 * 1024 })
  .toString()
  .split("\n")
  .filter(Boolean);

let hits = 0;
for (const rel of tracked) {
  const base = rel.split("/").pop() ?? rel;
  const dot = base.lastIndexOf(".");
  const ext = dot >= 0 ? base.slice(dot) : "";
  if (SKIP_FILE.has(base) || SKIP_EXT.has(ext)) continue;

  const abs = `${REPO_ROOT}/${rel}`;
  let text: string;
  try {
    if (statSync(abs).size > MAX_BYTES) continue;
    text = readFileSync(abs, "utf8");
  } catch {
    continue; // slettet/utilgængelig — skip
  }
  if (looksBinary(text)) continue;

  const { findings } = redactSecrets(text);
  if (findings.length) {
    hits += findings.reduce((n, f) => n + f.count, 0);
    const summary = findings.map((f) => `${f.label}×${f.count}`).join(", ");
    console.error(`✗ ${rel}: ${summary}`);
  }
}

if (hits > 0) {
  console.error(
    `\n🚫 secret-scan: ${hits} mulige hemmelighed(er) fundet i git-sporede filer. ` +
      `Fjern dem — commit ALDRIG nøgler (brug .env + flyctl secrets).`,
  );
  process.exit(1);
}
console.log(`✓ secret-scan: ${tracked.length} sporede filer, ingen hemmeligheder.`);

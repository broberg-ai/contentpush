import { useEffect, useMemo, useState } from "preact/hooks";

// F016.1: Drejebog-editor jf. godkendt mockup 019f71db. Redigér en drejebog
// (scener m. rolle, visual-kilde, speak da/en, skærmtekst, transition), auto-
// varighed fra speak-ordtal (÷150 wpm), AI-"Foreslå manus", valgfri musik
// (default FRA). "Byg video" er dark — kompilering er F016.2 (blokeret).

type Brand = { id: string; name: string };
type ScriptRow = {
  id: string;
  brandName: string | null;
  title: string;
  aspect: "16:9" | "9:16";
  targetDurationSec: number;
  status: string;
  renderStatus?: "idle" | "rendering" | "ready" | "failed";
  renderLang?: string | null;
  musicTrackId?: string | null;
};
type MusicTrack = {
  id: string;
  title: string;
  mood: string | null;
  durationSec: number | null;
  credit: string | null;
  url: string | null;
};
let previewAudio: HTMLAudioElement | null = null;
type Scene = {
  id: string;
  order: number;
  role: "hook" | "problem" | "solution" | "proof" | "cta";
  visualType: "ai-broll" | "ui-capture" | "still" | "logo";
  visualPrompt: string | null;
  voiceoverDa: string | null;
  voiceoverEn: string | null;
  onScreenText: string | null;
  transition: "cut" | "fade" | "slide";
};
type ScriptDetail = {
  script: ScriptRow & { languages: string[] | null; musicEnabled: boolean };
  scenes: Scene[];
  renderUrls?: Record<string, string>;
};

const ROLES: Array<[Scene["role"], string]> = [
  ["hook", "Hook"],
  ["problem", "Problem"],
  ["solution", "Løsning"],
  ["proof", "Bevis"],
  ["cta", "CTA"],
];
const VISUALS: Array<[Scene["visualType"], string]> = [
  ["ai-broll", "AI-klip"],
  ["ui-capture", "UI-optagelse"],
  ["still", "Still"],
  ["logo", "Logo"],
];
const TRANSITIONS: Scene["transition"][] = ["cut", "fade", "slide"];

function wc(t: string | null): number {
  return (t ?? "").trim().split(/\s+/).filter(Boolean).length;
}
function sceneSecs(s: Scene, lang: "da" | "en"): number {
  const words = wc(lang === "en" ? s.voiceoverEn : s.voiceoverDa);
  return Math.max(2, Math.round((words / 150) * 60));
}
function mmss(sec: number): string {
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
}

export function DrejebogEditor() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [scripts, setScripts] = useState<ScriptRow[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ScriptDetail | null>(null);
  const [lang, setLang] = useState<"da" | "en">("da");
  const [suggesting, setSuggesting] = useState(false);
  const [creating, setCreating] = useState(false);
  const [compiling, setCompiling] = useState(false);
  const [compileErr, setCompileErr] = useState<string | null>(null);
  const [form, setForm] = useState({ brandId: "", title: "", aspect: "16:9" as "16:9" | "9:16", targetDurationSec: 60 });
  const [musicTracks, setMusicTracks] = useState<MusicTrack[]>([]);
  const [musicOpen, setMusicOpen] = useState(false);

  useEffect(() => {
    fetch("/api/brands").then((r) => r.json()).then((d) => {
      setBrands(d.brands ?? []);
      setForm((f) => ({ ...f, brandId: f.brandId || (d.brands?.[0]?.id ?? "") }));
    });
    fetch("/api/scripts/music-tracks").then((r) => r.json()).then((d) => setMusicTracks(d.tracks ?? []));
  }, []);
  function loadScripts() {
    fetch("/api/scripts").then((r) => r.json()).then((d) => setScripts(d.scripts ?? []));
  }
  useEffect(loadScripts, []);
  useEffect(() => {
    if (!openId) { setDetail(null); return; }
    fetch(`/api/scripts/${openId}`).then((r) => r.json()).then(setDetail);
  }, [openId]);

  async function createScript(e: Event) {
    e.preventDefault();
    if (!form.brandId || !form.title.trim()) return;
    setCreating(true);
    const res = await fetch("/api/scripts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setCreating(false);
    if (res.ok) {
      const d = await res.json();
      loadScripts();
      setOpenId(d.script.id);
    }
  }

  async function patchScene(id: string, patch: Partial<Scene>) {
    setDetail((d) => d && { ...d, scenes: d.scenes.map((s) => (s.id === id ? { ...s, ...patch } : s)) });
    await fetch(`/api/scripts/scenes/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch),
    });
  }
  async function addScene() {
    if (!openId) return;
    const res = await fetch(`/api/scripts/${openId}/scenes`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role: "solution" }),
    });
    if (res.ok) { const { scene } = await res.json(); setDetail((d) => d && { ...d, scenes: [...d.scenes, scene] }); }
  }
  async function deleteScene(id: string) {
    await fetch(`/api/scripts/scenes/${id}`, { method: "DELETE" });
    setDetail((d) => d && { ...d, scenes: d.scenes.filter((s) => s.id !== id) });
  }
  async function setAspect(a: "16:9" | "9:16") {
    if (!openId || !detail) return;
    setDetail({ ...detail, script: { ...detail.script, aspect: a } });
    await fetch(`/api/scripts/${openId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ aspect: a }) });
  }
  async function suggest() {
    if (!openId) return;
    setSuggesting(true);
    const res = await fetch(`/api/scripts/${openId}/suggest`, { method: "POST" });
    setSuggesting(false);
    if (res.ok) { const { scenes } = await res.json(); setDetail((d) => d && { ...d, scenes }); }
  }
  // F016.2: "Byg video" — kompilér til mp4 (valgt sprog). Langt kald (minutter).
  async function compile() {
    if (!openId) return;
    setCompiling(true);
    setCompileErr(null);
    setDetail((d) => d && { ...d, script: { ...d.script, renderStatus: "rendering" } });
    try {
      const res = await fetch(`/api/scripts/${openId}/compile`, { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      const fresh = await fetch(`/api/scripts/${openId}`).then((r) => r.json());
      setDetail(fresh);
    } catch (err) {
      setCompileErr(err instanceof Error ? err.message : String(err));
      setDetail((d) => d && { ...d, script: { ...d.script, renderStatus: "failed" } });
    } finally {
      setCompiling(false);
    }
  }

  // F016.3: valgfrit baggrunds-musikspor (default fra) — vælg fra hylden
  async function pickMusic(id: string | null) {
    if (!openId) return;
    setMusicOpen(false);
    setDetail((d) => d && { ...d, script: { ...d.script, musicTrackId: id } });
    await fetch(`/api/scripts/${openId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ musicTrackId: id }) });
  }
  function previewTrack(url: string | null) {
    if (previewAudio) { previewAudio.pause(); previewAudio = null; }
    if (!url) return;
    previewAudio = new Audio(url);
    previewAudio.volume = 0.6;
    previewAudio.play().catch(() => {});
  }

  const total = useMemo(() => (detail ? detail.scenes.reduce((n, s) => n + sceneSecs(s, lang), 0) : 0), [detail, lang]);

  // ---- LISTE + OPRET ----
  if (!openId || !detail) {
    return (
      <section class="drejebog" data-testid="drejebog-root">
        <div class="dg-head"><h2>Drejebøger</h2><span>redigerbare video-manus → speak (da/en) + captions</span></div>
        <form class="dg-create" data-testid="drejebog-create" onSubmit={createScript}>
          <div class="brand-picker">
            {brands.map((b) => (
              <button type="button" key={b.id} data-testid={`drejebog-brand-${b.id}`}
                class={form.brandId === b.id ? "brand-pill active" : "brand-pill"}
                onClick={() => setForm({ ...form, brandId: b.id })}>{b.name}</button>
            ))}
          </div>
          <input class="dg-input" data-testid="drejebog-title" placeholder="Titel (fx lancerings-promo)"
            value={form.title} onInput={(e) => setForm({ ...form, title: (e.target as HTMLInputElement).value })} />
          <div class="seg" data-testid="drejebog-aspect">
            {(["16:9", "9:16"] as const).map((a) => (
              <button type="button" key={a} data-testid={`drejebog-aspect-${a === "16:9" ? "169" : "916"}`}
                class={form.aspect === a ? "on" : ""} onClick={() => setForm({ ...form, aspect: a })}>{a}</button>
            ))}
          </div>
          <input type="number" min={15} max={180} class="dg-input dg-num" data-testid="drejebog-duration"
            value={form.targetDurationSec} onInput={(e) => setForm({ ...form, targetDurationSec: Number((e.target as HTMLInputElement).value) || 60 })} />
          <button type="submit" class="btn-primary" data-testid="drejebog-create-submit" disabled={creating || !form.brandId || !form.title.trim()}>
            {creating ? "Opretter…" : "Ny drejebog"}
          </button>
        </form>
        <div class="dg-list" data-testid="drejebog-list">
          {scripts.length === 0 && <p class="queue-empty">Ingen drejebøger endnu.</p>}
          {scripts.map((s) => (
            <button type="button" key={s.id} class="dg-card" data-testid={`drejebog-open-${s.id}`} onClick={() => setOpenId(s.id)}>
              <span class="dg-card-title">{s.title}</span>
              <span class="dg-card-meta">{s.brandName ?? "—"} · {s.aspect} · mål {mmss(s.targetDurationSec)}</span>
            </button>
          ))}
        </div>
      </section>
    );
  }

  // ---- EDITOR ----
  const sc = detail.script;
  const currentTrack = musicTracks.find((t) => t.id === sc.musicTrackId) ?? null;
  return (
    <section class="drejebog" data-testid="drejebog-editor">
      <div class="dg-topbar">
        <button type="button" class="dg-back" data-testid="drejebog-back" onClick={() => setOpenId(null)}>← Drejebøger</button>
        <div class="dg-brand"><b>{sc.title}</b><span>{sc.brandName ?? "—"}</span></div>
        <div class="dg-ctl"><span class="lbl">Sprog</span>
          <div class="seg" data-testid="drejebog-lang">
            <button type="button" data-testid="drejebog-lang-da" class={lang === "da" ? "on" : ""} onClick={() => setLang("da")}>DA</button>
            <button type="button" data-testid="drejebog-lang-en" class={lang === "en" ? "on" : ""} onClick={() => setLang("en")}>EN</button>
          </div>
        </div>
        <div class="dg-ctl"><span class="lbl">Format</span>
          <div class="seg" data-testid="drejebog-fmt">
            <button type="button" data-testid="drejebog-fmt-169" class={sc.aspect === "16:9" ? "on" : ""} onClick={() => setAspect("16:9")}>16:9</button>
            <button type="button" data-testid="drejebog-fmt-916" class={sc.aspect === "9:16" ? "on" : ""} onClick={() => setAspect("9:16")}>9:16</button>
          </div>
        </div>
        <button type="button" class="btn-secondary" data-testid="drejebog-suggest" onClick={suggest} disabled={suggesting}>
          {suggesting ? "Skriver…" : "✨ Foreslå manus"}
        </button>
        <span class="dg-runtime" data-testid="drejebog-runtime">Længde <b>{mmss(total)}</b> / mål {mmss(sc.targetDurationSec)}</span>
      </div>

      <div class="dg-grid">
        <div class="dg-scenes" data-testid="drejebog-scenes">
          {detail.scenes.length === 0 && (
            <p class="queue-empty">Ingen scener endnu — tryk “Foreslå manus”, eller tilføj en scene.</p>
          )}
          {detail.scenes.map((s, i) => (
            <article class="dg-scene" data-testid={`drejebog-scene-${s.id}`} key={s.id}>
              <header class="dg-shead">
                <span class="dg-idx">{i + 1}</span>
                <div class="seg role-seg" data-testid={`drejebog-role-${s.id}`}>
                  {ROLES.map(([r, label]) => (
                    <button type="button" key={r} data-testid={`drejebog-role-${s.id}-${r}`} class={s.role === r ? "on" : ""} onClick={() => patchScene(s.id, { role: r })}>{label}</button>
                  ))}
                </div>
                <span class="dg-dur">{mmss(sceneSecs(s, lang))}</span>
                <button type="button" class="dg-del" data-testid={`drejebog-scene-del-${s.id}`} aria-label="Slet scene" onClick={() => deleteScene(s.id)}>✕</button>
              </header>
              <div class="dg-sbody">
                <div class="dg-col dg-visual">
                  <span class="lbl">Billede</span>
                  <div class="seg vis-seg" data-testid={`drejebog-visual-${s.id}`}>
                    {VISUALS.map(([v, label]) => (
                      <button type="button" key={v} data-testid={`drejebog-visual-${s.id}-${v}`} class={s.visualType === v ? "on" : ""} onClick={() => patchScene(s.id, { visualType: v })}>{label}</button>
                    ))}
                  </div>
                  <textarea class="dg-prompt" data-testid={`drejebog-prompt-${s.id}`} placeholder="Beskriv billedet/klippet…"
                    value={s.visualPrompt ?? ""} onBlur={(e) => patchScene(s.id, { visualPrompt: (e.target as HTMLTextAreaElement).value })} />
                </div>
                <div class="dg-col dg-audio">
                  <span class="lbl">Speak ({lang.toUpperCase()})</span>
                  <textarea class="dg-vo" data-testid={`drejebog-vo-${s.id}`} placeholder={lang === "da" ? "Dansk speak…" : "Engelsk speak…"}
                    value={(lang === "en" ? s.voiceoverEn : s.voiceoverDa) ?? ""}
                    onBlur={(e) => patchScene(s.id, lang === "en" ? { voiceoverEn: (e.target as HTMLTextAreaElement).value } : { voiceoverDa: (e.target as HTMLTextAreaElement).value })} />
                  <div class="dg-sfoot">
                    <input class="dg-ost" data-testid={`drejebog-ost-${s.id}`} placeholder="skærmtekst (valgfri)"
                      value={s.onScreenText ?? ""} onBlur={(e) => patchScene(s.id, { onScreenText: (e.target as HTMLInputElement).value })} />
                    <div class="seg trans-seg" data-testid={`drejebog-trans-${s.id}`}>
                      {TRANSITIONS.map((t) => (
                        <button type="button" key={t} data-testid={`drejebog-trans-${s.id}-${t}`} class={s.transition === t ? "on" : ""} onClick={() => patchScene(s.id, { transition: t })}>{t}</button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </article>
          ))}
          <button type="button" class="dg-addscene" data-testid="drejebog-add-scene" onClick={addScene}>+ Tilføj scene</button>
        </div>

        <aside class="dg-rail">
          <div class="dg-preview">
            <div class={`dg-frame ${sc.aspect === "16:9" ? "r169" : "r916"}`} data-testid="drejebog-preview">
              {detail.renderUrls?.[lang] ? (
                <video key={lang} class="dg-video" src={detail.renderUrls[lang]} controls playsInline data-testid="drejebog-video" />
              ) : (
                <>
                  <span class="dg-play">▶</span>
                  <div class="dg-lt"><span class="dg-cap">{detail.scenes[0]?.onScreenText || (lang === "en" ? detail.scenes[0]?.voiceoverEn : detail.scenes[0]?.voiceoverDa) || "—"}</span></div>
                </>
              )}
            </div>
          </div>
          <div class="dg-opt dg-music" data-testid="drejebog-music">
            <div class="dg-opt-h"><label>Musik</label><span class="tag">valgfri · fra som standard</span></div>
            <button type="button" class="dg-music-toggle" data-testid="drejebog-music-toggle"
              aria-expanded={musicOpen} onClick={() => setMusicOpen((o) => !o)}>
              <span>{currentTrack ? `${currentTrack.title}${currentTrack.mood ? ` · ${currentTrack.mood}` : ""}` : "Ingen musik"}</span>
              <span class="dg-music-caret">▾</span>
            </button>
            {musicOpen && (
              <div class="dg-music-menu" data-testid="drejebog-music-menu">
                <button type="button" class={`dg-music-opt${sc.musicTrackId ? "" : " on"}`} data-testid="drejebog-music-none"
                  onClick={() => { previewTrack(null); pickMusic(null); }}>Ingen musik</button>
                {musicTracks.map((t) => (
                  <div class={`dg-music-opt${sc.musicTrackId === t.id ? " on" : ""}`} key={t.id}>
                    <button type="button" class="dg-music-pick" data-testid={`drejebog-music-opt-${t.id}`} onClick={() => pickMusic(t.id)}>
                      <b>{t.title}</b>{t.mood ? <span class="dg-music-mood">{t.mood}</span> : null}
                    </button>
                    {t.url && (
                      <button type="button" class="dg-music-play" data-testid={`drejebog-music-play-${t.id}`}
                        aria-label={`Afspil ${t.title}`} onClick={() => previewTrack(t.url)}>▶</button>
                    )}
                  </div>
                ))}
              </div>
            )}
            <p class="dg-hint">{currentTrack?.credit ?? "Vælg fra din royalty-free hylde — kun når den gør videoen bedre."}</p>
          </div>
          <div class="dg-opt dg-row"><label>Undertekster</label><span class="dg-toggle on">ord-for-ord ✓</span></div>
          <div class="dg-opt"><label>Leverer</label>
            <div class="dg-deliver">
              {(sc.languages ?? ["da", "en"]).map((l) => <span class="pill ok" key={l}>Speak {l.toUpperCase()}</span>)}
              <span class="pill ok">{sc.aspect}</span><span class="pill ok">Captions</span>
            </div>
          </div>
          <button
            type="button"
            class="dg-build"
            data-testid="drejebog-build"
            disabled={compiling || detail.scenes.length === 0}
            onClick={compile}
          >
            {compiling
              ? "Bygger video… (~1-2 min)"
              : detail.renderUrls && Object.keys(detail.renderUrls).length > 0
                ? "↻ Byg video igen"
                : "Byg video"}
          </button>
          {compileErr && (
            <p class="dg-note dg-err" data-testid="drejebog-compile-error">{compileErr}</p>
          )}
          <p class="dg-note">
            {detail.renderUrls && Object.keys(detail.renderUrls).length > 0
              ? `Video klar på ${Object.keys(detail.renderUrls).map((l) => l.toUpperCase()).join(" + ")} — skift med DA/EN. Tale via Azure.`
              : "Bygger én video pr. sprog (DA + EN). Tale via Azure — skift sprog med DA/EN foroven."}
          </p>
        </aside>
      </div>
    </section>
  );
}

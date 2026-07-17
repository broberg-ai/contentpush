import { useEffect, useState } from "preact/hooks";
import type { Post } from "./QueueBoard";

// F012.5: story-detaljen som FULD SHEET-VISNING (ikke modal — Christians
// feedback 2026-07-04) jf. godkendt detalje-mockup: én platform ad gangen
// bag faner, platform-tro preview, oprindelse + historik i højre kolonne.

export type PostDetailData = Post & {
  ideaText: string | null;
  gridUrl: string | null;
  // F014.2: video på opslaget — tilstand + signerede URL'er pr. format
  mediaType?: "stock" | "ai-generated" | "video" | null;
  videoStatus?: "none" | "suggested" | "approved" | "rendering" | "ready" | "failed";
  videoTechnique?: "template" | "ai" | null;
  videoUrls?: { "16:9": string | null; "9:16": string | null };
};

// F014.2: preview viser video når opslaget har en (still = poster/fallback),
// ellers still-billedet, ellers pending-pladsholder. LinkedIn/Facebook bruger
// 16:9, Instagram 9:16.
function PreviewMedia({
  post,
  aspect,
  square,
}: {
  post: PostDetailData;
  aspect: "16:9" | "9:16";
  square?: boolean;
}) {
  const cls = square ? "pm-image pm-image-square" : "pm-image";
  const videoUrl = post.videoUrls?.[aspect] ?? null;
  if (videoUrl) {
    return (
      <video
        class={cls}
        src={videoUrl}
        poster={post.gridUrl ?? undefined}
        controls
        muted
        loop
        playsInline
        data-testid={`preview-video-${aspect === "16:9" ? "169" : "916"}`}
      />
    );
  }
  if (post.gridUrl) return <img class={cls} src={post.gridUrl} alt="" />;
  return <div class={`${cls} pm-image-pending`}>billede kommer (F012.4)</div>;
}

type ActionState = { running: string | null; message: string | null; error: string | null };

const PLATFORMS: Array<{ key: string; label: string; field: keyof Post }> = [
  { key: "linkedin", label: "LinkedIn", field: "linkedinText" },
  { key: "instagram", label: "Instagram", field: "instagramText" },
  { key: "facebook", label: "Facebook", field: "facebookText" },
];

const STATUS_LABELS: Record<Post["status"], string> = {
  draft: "Kladde",
  ready: "Klar til at poste",
  posted: "Postet",
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("da-DK", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function Avatar({ label }: { label: string }) {
  return <span class="pm-avatar">{label}</span>;
}

function LinkedInPreview({ post }: { post: PostDetailData }) {
  return (
    <div class="postmock" data-testid="preview-linkedin">
      <div class="pm-head">
        <Avatar label="CB" />
        <div>
          <b>Christian Broberg</b>
          <small>
            Founder &amp; Chief Software Architect, WebHouse
            <br />
            Nu · 🌐
          </small>
        </div>
      </div>
      <p class="pm-text">{post.linkedinText}</p>
      {post.hashtags?.linkedin?.length ? (
        <p class="pm-tags">{post.hashtags.linkedin.join(" ")}</p>
      ) : null}
      <PreviewMedia post={post} aspect="16:9" />
      <div class="pm-bar">
        <span>👍 Synes godt om</span>
        <span>💬 Kommenter</span>
        <span>↗ Del</span>
      </div>
    </div>
  );
}

function InstagramPreview({ post }: { post: PostDetailData }) {
  const handle = (post.brandName ?? "brand").replace(/\..*$/, "").toLowerCase();
  return (
    <div class="postmock" data-testid="preview-instagram">
      <div class="pm-head">
        <Avatar label={handle.slice(0, 2).toUpperCase()} />
        <div>
          <b>{handle}</b>
        </div>
        <span class="pm-more">⋯</span>
      </div>
      <PreviewMedia post={post} aspect="9:16" square />
      <div class="pm-bar pm-bar-ig">
        <span>♡</span>
        <span>💬</span>
        <span>✈</span>
        <span class="pm-save">🔖</span>
      </div>
      <p class="pm-text pm-caption">
        <b>{handle}</b> {post.instagramText}
      </p>
      {post.hashtags?.instagram?.length ? (
        <p class="pm-tags">{post.hashtags.instagram.join(" ")}</p>
      ) : null}
    </div>
  );
}

function FacebookPreview({ post }: { post: PostDetailData }) {
  return (
    <div class="postmock" data-testid="preview-facebook">
      <div class="pm-head">
        <Avatar label={(post.brandName ?? "B").slice(0, 1).toUpperCase()} />
        <div>
          <b>{post.brandName}</b>
          <small>Nu · 🌐</small>
        </div>
      </div>
      <p class="pm-text">{post.facebookText}</p>
      {post.hashtags?.facebook?.length ? (
        <p class="pm-tags">{post.hashtags.facebook.join(" ")}</p>
      ) : null}
      <PreviewMedia post={post} aspect="16:9" />
      <div class="pm-bar">
        <span>👍 Synes godt om</span>
        <span>💬 Kommenter</span>
        <span>↗ Del</span>
      </div>
    </div>
  );
}

export function StoryDetail({
  post: initial,
  onClose,
  onChanged,
}: {
  post: Post;
  onClose: () => void;
  onChanged: (updated: Post) => void;
}) {
  const [post, setPost] = useState<PostDetailData>({
    ...initial,
    ideaText: null,
    gridUrl: null,
  });
  const [tab, setTab] = useState<string | null>(null);
  const [state, setState] = useState<ActionState>({ running: null, message: null, error: null });

  useEffect(() => {
    fetch(`/api/posts/${initial.id}`)
      .then((r) => r.json())
      .then(({ post }: { post: PostDetailData }) => setPost(post));
  }, [initial.id]);

  const available = PLATFORMS.filter(({ field }) => post[field]);
  const activeKey = tab ?? available[0]?.key ?? null;

  async function downloadPackage() {
    setState({ running: "download", message: null, error: null });
    try {
      const res = await fetch(`/api/posts/${post.id}/package`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download =
        res.headers.get("Content-Disposition")?.match(/filename="(.+)"/)?.[1] ??
        "contentpush-pakke.zip";
      a.click();
      URL.revokeObjectURL(url);
      setState({ running: null, message: "Pakken er downloadet", error: null });
    } catch (err) {
      setState({
        running: null,
        message: null,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // F012.6: kopiér platformens tekst + hashtags — hurtigere end zip når man
  // står i LinkedIn. Hashtags på egen blok efter dobbelt linjeskift.
  async function copyPlatform(key: string, field: keyof Post, label: string) {
    setState({ running: `copy-${key}`, message: null, error: null });
    try {
      const text = [
        post[field] as string,
        (post.hashtags?.[key] ?? []).join(" "),
      ]
        .filter(Boolean)
        .join("\n\n");
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        // Fallback (ældre browsere / manglende clipboard-permission):
        // skjult textarea + execCommand — samme resultat, bredere støtte
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand("copy");
        ta.remove();
        if (!ok) throw new Error("clipboard ikke tilgængelig");
      }
      setState({ running: null, message: `${label}-tekst kopieret`, error: null });
    } catch (err) {
      setState({
        running: null,
        message: null,
        error: `Kunne ikke kopiere: ${err instanceof Error ? err.message : err}`,
      });
    }
  }

  async function regenerateImage() {
    setState({ running: "image", message: null, error: null });
    try {
      const res = await fetch(`/api/posts/${post.id}/regenerate-image`, { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      setState({ running: null, message: "Nyt billede er klar", error: null });
      setPost((p) => ({ ...p, ...body.post }));
      onChanged({ ...post, ...body.post });
    } catch (err) {
      setState({
        running: null,
        message: null,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // F014.2: lav gratis skabelon-video (16:9 + 9:16) fra opslagets still
  async function makeTemplateVideo() {
    setState({ running: "video", message: null, error: null });
    try {
      const res = await fetch(`/api/posts/${post.id}/video/template`, { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      setState({ running: null, message: "Skabelon-video er klar", error: null });
      setPost((p) => ({ ...p, ...body.post, videoUrls: body.videoUrls }));
      onChanged({ ...post, ...body.post });
    } catch (err) {
      setState({
        running: null,
        message: null,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // F014.3: godkend forslag → generér AI-klip (~1-2 min). Optimistisk 'rendering'
  // mens vi venter, så banneret viser fremgang.
  async function approveVideo() {
    setState({ running: "approve-video", message: null, error: null });
    setPost((p) => ({ ...p, videoStatus: "rendering" }));
    try {
      const res = await fetch(`/api/posts/${post.id}/video/approve`, { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      setState({ running: null, message: "AI-video er klar", error: null });
      setPost((p) => ({ ...p, ...body.post, videoUrls: body.videoUrls }));
      onChanged({ ...post, ...body.post });
    } catch (err) {
      setPost((p) => ({ ...p, videoStatus: "failed" }));
      setState({
        running: null,
        message: null,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // F014.3: afvis forslag → behold skabelon-videoen (intet AI-kald)
  async function rejectVideo() {
    setState({ running: "reject-video", message: null, error: null });
    try {
      const res = await fetch(`/api/posts/${post.id}/video/reject`, { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      setState({ running: null, message: "Beholder skabelon", error: null });
      setPost((p) => ({ ...p, ...body.post, videoUrls: body.videoUrls }));
      onChanged({ ...post, ...body.post });
    } catch (err) {
      setState({
        running: null,
        message: null,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  async function runAction(action: "approve" | "regenerate" | "mark-posted", doneMessage: string) {
    setState({ running: action, message: null, error: null });
    try {
      const res = await fetch(`/api/posts/${post.id}/${action}`, { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      setState({ running: null, message: doneMessage, error: null });
      const updated = { ...post, ...body.post };
      setPost(updated);
      onChanged(updated);
    } catch (err) {
      setState({
        running: null,
        message: null,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return (
    <section class="story-sheet" data-testid="story-sheet">
      <header class="sheet-head">
        <div>
          <h2>{post.headline}</h2>
          <p class="sheet-meta">
            <span class="post-card-brand">{post.brandName ?? "—"}</span>
            {" · planlagt "}
            <b>{formatDate(post.scheduledDate)}</b>
            {" · "}
            <span class="sheet-status" data-testid="story-sheet-status">
              {STATUS_LABELS[post.status]}
            </span>
          </p>
        </div>
        <button
          type="button"
          class="modal-close"
          aria-label="Luk"
          data-testid="story-sheet-close"
          onClick={onClose}
        >
          ×
        </button>
      </header>

      <div class="sheet-cols">
        <div class="sheet-main">
          {post.videoStatus === "suggested" && (
            <div class="video-suggest" data-testid="video-suggest-banner">
              <div class="video-suggest-text">
                <b>🎬 Hero-opslag — værd at lave som AI-video</b>
                <p>
                  Knyttet til en lancering eller mærkedag. En AI-genereret video
                  (16:9 + 9:16) løfter rækkevidden — koster lidt (~5 kr) og tager
                  1-2 min. Skabelon-video er altid gratis.
                </p>
              </div>
              <div class="video-suggest-actions">
                <button
                  type="button"
                  class="btn-primary"
                  data-testid="post-approve-video-button"
                  disabled={state.running !== null}
                  onClick={approveVideo}
                >
                  {state.running === "approve-video" ? "Genererer…" : "Godkend AI-video"}
                </button>
                <button
                  type="button"
                  class="btn-secondary"
                  data-testid="post-reject-video-button"
                  disabled={state.running !== null}
                  onClick={rejectVideo}
                >
                  {state.running === "reject-video" ? "Beholder…" : "Behold skabelon"}
                </button>
              </div>
            </div>
          )}
          {post.videoStatus === "rendering" && (
            <div class="video-suggest" data-testid="video-rendering-banner">
              <div class="video-suggest-text">
                <b>⏳ Genererer AI-video… (~1-2 min)</b>
                <p>Kling laver 16:9 + 9:16-klip fra billedet. Bliv på siden.</p>
              </div>
            </div>
          )}
          <nav class="ptabs" data-testid="story-platform-tabs">
            {available.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                class={activeKey === key ? "ptab active" : "ptab"}
                data-testid={`story-tab-${key}`}
                onClick={() => setTab(key)}
              >
                {label}
              </button>
            ))}
          </nav>
          {activeKey === "linkedin" && <LinkedInPreview post={post} />}
          {activeKey === "instagram" && <InstagramPreview post={post} />}
          {activeKey === "facebook" && <FacebookPreview post={post} />}
          <div class="media-actions">
            <button
              type="button"
              class="btn-secondary"
              data-testid="post-regenerate-image-button"
              disabled={state.running !== null}
              onClick={regenerateImage}
            >
              {state.running === "image"
                ? "Genererer billede…"
                : post.gridUrl
                  ? "↻ Regenerér billede"
                  : "Generér billede"}
            </button>
            <button
              type="button"
              class="btn-secondary"
              data-testid="post-make-video-button"
              disabled={state.running !== null || !post.gridUrl}
              onClick={makeTemplateVideo}
            >
              {state.running === "video"
                ? "Laver video…"
                : post.videoUrls?.["16:9"]
                  ? "↻ Regenerér video"
                  : "🎬 Lav skabelon-video"}
            </button>
            <span class="media-actions-note">
              {!post.gridUrl
                ? "Storyen mangler sit billede"
                : post.videoUrls?.["16:9"]
                  ? "Video klar i 16:9 + 9:16 — gratis skabelon"
                  : "Gratis skabelon-video (16:9 + 9:16) fra billedet"}
            </span>
          </div>
        </div>

        <aside class="sheet-side">
          <h3>Oprindelse</h3>
          {post.ideaText ? (
            <blockquote class="sheet-idea" data-testid="story-origin-idea">
              {post.ideaText}
              <small>Din idé — bygget ordret ind i opslaget</small>
            </blockquote>
          ) : (
            <p class="sheet-side-muted">Auto-genereret ud fra brandets voice (ingen idé i biblioteket).</p>
          )}
          <h3>Historik</h3>
          <div class="tl">
            <div class="step">
              <span class="rail">
                <span class="dot" />
                <span class="line" />
              </span>
              <p>
                Genereret{post.ideaText ? " fra din idé" : " (auto)"}
                <small>{formatDate(post.createdAt)}</small>
              </p>
            </div>
            <div class="step">
              <span class="rail">
                <span class={post.status === "draft" ? "dot open" : "dot"} />
                <span class="line" />
              </span>
              <p>
                {post.status === "draft" ? <b>Venter på din godkendelse</b> : "Godkendt"}
              </p>
            </div>
            <div class="step">
              <span class="rail">
                <span class={post.status === "posted" ? "dot" : "dot open"} />
              </span>
              <p>
                {post.status === "posted" ? (
                  <>
                    Postet<small>{formatDate(post.postedAt)}</small>
                  </>
                ) : (
                  <>
                    Poster {formatDate(post.scheduledDate)}
                    <small>du får besked på dagen</small>
                  </>
                )}
              </p>
            </div>
          </div>
        </aside>
      </div>

      <footer class="sheet-actions">
        {post.status === "draft" && (
          <>
            <button
              type="button"
              class="btn-primary"
              data-testid="post-approve-button"
              disabled={state.running !== null}
              onClick={() => runAction("approve", "Godkendt — flyttet til Klar")}
            >
              {state.running === "approve" ? "Godkender…" : "Godkend ✓"}
            </button>
            <button
              type="button"
              class="btn-secondary"
              data-testid="post-regenerate-button"
              disabled={state.running !== null}
              onClick={() => runAction("regenerate", "Teksterne er regenereret")}
            >
              {state.running === "regenerate" ? "Regenererer…" : "Regenerér tekst"}
            </button>
          </>
        )}
        {post.status === "ready" && (
          <button
            type="button"
            class="btn-primary"
            data-testid="post-mark-posted-button"
            disabled={state.running !== null}
            onClick={() => runAction("mark-posted", "Markeret som postet — næste opslag er planlagt")}
          >
            {state.running === "mark-posted" ? "Markerer…" : "Markér som postet"}
          </button>
        )}
        {available.map(({ key, label, field }) => (
          <button
            key={key}
            type="button"
            class="btn-secondary"
            data-testid={`post-copy-${key}-button`}
            disabled={state.running !== null}
            onClick={() => copyPlatform(key, field, label)}
          >
            {state.running === `copy-${key}` ? "Kopierer…" : `📋 ${label}`}
          </button>
        ))}
        {(post.status === "ready" || post.status === "posted") && (
          <button
            type="button"
            class="btn-secondary"
            data-testid="post-download-button"
            disabled={state.running !== null}
            onClick={downloadPackage}
          >
            {state.running === "download" ? "Pakker…" : "⬇ Download pakke"}
          </button>
        )}
        {state.message && (
          <span class="save-confirm" data-testid="post-action-confirm">
            {state.message} ✓
          </span>
        )}
        {state.error && (
          <span class="save-error" data-testid="post-action-error">
            {state.error}
          </span>
        )}
      </footer>
    </section>
  );
}

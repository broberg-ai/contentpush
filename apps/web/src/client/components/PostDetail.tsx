import { useState } from "preact/hooks";
import { Modal } from "./ui/modal";
import type { Post } from "./QueueBoard";

type ActionState = { running: string | null; message: string | null; error: string | null };

const PLATFORMS: Array<{ key: string; label: string; field: keyof Post }> = [
  { key: "linkedin", label: "LinkedIn", field: "linkedinText" },
  { key: "instagram", label: "Instagram", field: "instagramText" },
  { key: "facebook", label: "Facebook", field: "facebookText" },
];

export function PostDetail({
  post,
  onClose,
  onChanged,
}: {
  post: Post;
  onClose: () => void;
  onChanged: (updated: Post) => void;
}) {
  const [state, setState] = useState<ActionState>({ running: null, message: null, error: null });

  async function runAction(action: "approve" | "regenerate" | "mark-posted", doneMessage: string) {
    setState({ running: action, message: null, error: null });
    try {
      const res = await fetch(`/api/posts/${post.id}/${action}`, { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      setState({ running: null, message: doneMessage, error: null });
      onChanged({ ...post, ...body.post });
    } catch (err) {
      setState({
        running: null,
        message: null,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return (
    <Modal title={post.headline} onClose={onClose} testid="post-detail">
      <p class="post-detail-meta">
        <span class="post-card-brand">{post.brandName ?? "—"}</span>
        {" · "}
        <span data-testid="post-detail-status">
          {post.status === "draft" && "Kladde"}
          {post.status === "ready" && "Klar til at poste"}
          {post.status === "posted" && "Postet"}
        </span>
      </p>

      {PLATFORMS.filter(({ field }) => post[field]).map(({ key, label, field }) => (
        <section key={key} class="post-detail-platform" data-testid={`post-detail-${key}`}>
          <h3>{label}</h3>
          <p class="post-detail-text">{post[field] as string}</p>
          {post.hashtags?.[key]?.length ? (
            <p class="post-detail-hashtags">{post.hashtags[key].join(" ")}</p>
          ) : null}
        </section>
      ))}

      <footer class="post-detail-footer">
        {post.status === "draft" && (
          <>
            <button
              type="button"
              class="btn-primary"
              data-testid="post-approve-button"
              disabled={state.running !== null}
              onClick={() => runAction("approve", "Godkendt — flyttet til Klar")}
            >
              {state.running === "approve" ? "Godkender…" : "Godkend"}
            </button>
            <button
              type="button"
              class="btn-secondary"
              data-testid="post-regenerate-button"
              disabled={state.running !== null}
              onClick={() => runAction("regenerate", "Teksterne er regenereret")}
            >
              {state.running === "regenerate" ? "Regenererer…" : "Regenerér"}
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
    </Modal>
  );
}

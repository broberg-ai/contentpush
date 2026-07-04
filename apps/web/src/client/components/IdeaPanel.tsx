import { useEffect, useState } from "preact/hooks";

export type Idea = {
  id: string;
  brandId: string | null;
  brandName: string | null;
  rawText: string;
  status: "captured" | "enriched" | "planned" | "used" | "archived";
  createdAt: string;
};

const STATUS_LABELS: Record<Idea["status"], string> = {
  captured: "MODTAGET",
  enriched: "VENTER",
  planned: "PLANLAGT",
  used: "BRUGT",
  archived: "ARKIVERET",
};

export function IdeaPanel({ refreshKey }: { refreshKey?: number }) {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [text, setText] = useState("");
  const [state, setState] = useState<{
    running: boolean;
    message: string | null;
    error: string | null;
  }>({ running: false, message: null, error: null });

  const load = () =>
    fetch("/api/ideas")
      .then((r) => r.json())
      .then(({ ideas }: { ideas: Idea[] }) => setIdeas(ideas));

  useEffect(() => {
    load();
  }, [refreshKey]);

  async function submit(e: Event) {
    e.preventDefault();
    if (!text.trim()) return;
    setState({ running: true, message: null, error: null });
    try {
      const res = await fetch("/api/ideas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawText: text.trim() }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      setText("");
      setState({ running: false, message: "Idéen er gemt", error: null });
      await load();
      // AI'en vælger brand i baggrunden — hent status igen når den er klar
      setTimeout(load, 45_000);
    } catch (err) {
      setState({
        running: false,
        message: null,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  async function archive(id: string) {
    await fetch(`/api/ideas/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "archived" }),
    });
    await load();
  }

  return (
    <aside class="idea-panel" data-testid="idea-panel">
      <h3>Idé-biblioteket</h3>
      <form class="idea-form" data-testid="idea-form" onSubmit={submit}>
        <textarea
          rows={3}
          placeholder="Smid en idé ind — den gemmes ordret og bliver til den næste story…"
          data-testid="idea-input"
          value={text}
          onInput={(e) => setText((e.target as HTMLTextAreaElement).value)}
        />
        <div class="idea-form-footer">
          <button
            type="submit"
            class="btn-primary"
            data-testid="idea-submit"
            disabled={state.running || !text.trim()}
          >
            {state.running ? "Gemmer…" : "Gem idé"}
          </button>
          {state.message && (
            <span class="save-confirm" data-testid="idea-confirm">
              {state.message} ✓
            </span>
          )}
          {state.error && (
            <span class="save-error" data-testid="idea-error">
              {state.error}
            </span>
          )}
        </div>
      </form>
      {ideas.length === 0 && (
        <p class="queue-empty">Ingen idéer endnu — generatoren opfinder selv indtil du fodrer den.</p>
      )}
      <ul class="idea-list" data-testid="idea-list">
        {ideas.map((idea) => (
          <li key={idea.id} class="idea-item" data-testid={`idea-item-${idea.id}`}>
            <p class="idea-text">{idea.rawText}</p>
            <div class="idea-meta">
              <span class="idea-brand">{idea.brandName ?? "intet brand"}</span>
              <span class={`idea-status idea-status-${idea.status}`}>
                {STATUS_LABELS[idea.status]}
              </span>
              {idea.status !== "used" && (
                <button
                  type="button"
                  class="idea-archive"
                  data-testid={`idea-archive-${idea.id}`}
                  title="Arkivér idé"
                  onClick={() => archive(idea.id)}
                >
                  ✕
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </aside>
  );
}

import { useState } from "preact/hooks";

// F011.2: custom nøgle-login (aldrig native dialogs). Vises når API'et
// kræver login; ved succes genindlæses appen med session-cookien sat.
export function LoginGate({ onAuthed }: { onAuthed: () => void }) {
  const [key, setKey] = useState("");
  const [state, setState] = useState<{ running: boolean; error: string | null }>({
    running: false,
    error: null,
  });

  async function submit(e: Event) {
    e.preventDefault();
    if (!key.trim()) return;
    setState({ running: true, error: null });
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: key.trim() }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      onAuthed();
    } catch (err) {
      setState({
        running: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return (
    <div class="login-gate" data-testid="login-gate">
      <form class="login-card" data-testid="login-form" onSubmit={submit}>
        <h1>Contentpush</h1>
        <p class="login-sub">Indtast adgangsnøglen for at åbne dashboardet.</p>
        <input
          type="password"
          placeholder="Adgangsnøgle"
          data-testid="login-key-input"
          value={key}
          onInput={(e) => setKey((e.target as HTMLInputElement).value)}
        />
        <button
          type="submit"
          class="btn-primary"
          data-testid="login-submit"
          disabled={state.running || !key.trim()}
        >
          {state.running ? "Logger ind…" : "Log ind"}
        </button>
        {state.error && (
          <p class="save-error" data-testid="login-error">
            {state.error}
          </p>
        )}
      </form>
    </div>
  );
}

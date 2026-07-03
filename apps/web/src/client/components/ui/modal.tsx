import type { ComponentChildren } from "preact";
import { useEffect } from "preact/hooks";

// Genbrugelig modal (components/ui) — ALDRIG native dialoger (husregel).
// Overlay-klik og Escape lukker; indholdet bestemmer selv footer/actions.
export function Modal({
  title,
  onClose,
  children,
  testid = "modal",
}: {
  title: string;
  onClose: () => void;
  children: ComponentChildren;
  testid?: string;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      class="modal-overlay"
      data-testid={`${testid}-overlay`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div class="modal-card" role="dialog" aria-modal="true" data-testid={testid}>
        <header class="modal-header">
          <h2>{title}</h2>
          <button
            type="button"
            class="modal-close"
            aria-label="Luk"
            data-testid={`${testid}-close`}
            onClick={onClose}
          >
            ×
          </button>
        </header>
        <div class="modal-body">{children}</div>
      </div>
    </div>
  );
}

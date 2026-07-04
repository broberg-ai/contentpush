import { render } from "preact";
import { useState } from "preact/hooks";
import { init as initUpmetrics } from "@upmetrics/sdk";
import { initTheme } from "@broberg/theme/preact";
import { BrandSettings } from "./components/BrandSettings";
import { QueueBoard, type Post } from "./components/QueueBoard";
import { CalendarView } from "./components/CalendarView";
import { IdeaPanel } from "./components/IdeaPanel";
import { PostDetail } from "./components/PostDetail";
import "./styles/tokens.css";
import "./styles/app.css";

initTheme({ defaultTheme: "light-warm" });

const upmetricsDsn = import.meta.env.VITE_UPMETRICS_DSN as string | undefined;
if (upmetricsDsn) {
  initUpmetrics({ dsn: upmetricsDsn, environment: import.meta.env.MODE });
}

function App() {
  const [openPost, setOpenPost] = useState<Post | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  // F012.1: kalenderen er forsiden; kø-viewet består som sekundær visning
  const [view, setView] = useState<"calendar" | "queue">("calendar");

  return (
    <div class="app-shell" data-testid="app-root">
      <header class="app-header" data-testid="app-header">
        <h1>Contentpush</h1>
        <nav class="view-tabs" data-testid="view-tabs">
          <button
            type="button"
            class={view === "calendar" ? "view-tab active" : "view-tab"}
            data-testid="view-tab-calendar"
            onClick={() => setView("calendar")}
          >
            Kalender
          </button>
          <button
            type="button"
            class={view === "queue" ? "view-tab active" : "view-tab"}
            data-testid="view-tab-queue"
            onClick={() => setView("queue")}
          >
            Kø
          </button>
        </nav>
      </header>
      <main class="app-main" data-testid="app-main">
        {view === "calendar" ? (
          <div class="calendar-layout">
            <CalendarView refreshKey={refreshKey} onOpen={setOpenPost} />
            <IdeaPanel refreshKey={refreshKey} />
          </div>
        ) : (
          <>
            <QueueBoard
              activeBrandId={null}
              refreshKey={refreshKey}
              onOpen={setOpenPost}
            />
            <BrandSettings />
          </>
        )}
      </main>
      {openPost && (
        <PostDetail
          post={openPost}
          onClose={() => setOpenPost(null)}
          onChanged={(updated) => {
            setOpenPost(updated);
            setRefreshKey((k) => k + 1);
          }}
        />
      )}
    </div>
  );
}

render(<App />, document.getElementById("app")!);

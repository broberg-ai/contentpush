import { render } from "preact";
import { useEffect, useState } from "preact/hooks";
import { init as initUpmetrics } from "@upmetrics/sdk";
import { initTheme } from "@broberg/theme/preact";
import { BrandSettings } from "./components/BrandSettings";
import { BrandDrafts } from "./components/BrandDrafts";
import { BrandSwitcher } from "./components/BrandSwitcher";
import { QueueBoard, type Post } from "./components/QueueBoard";
import { CalendarView } from "./components/CalendarView";
import { IdeaPanel } from "./components/IdeaPanel";
import { NextFive } from "./components/NextFive";
import { StoryDetail } from "./components/StoryDetail";
import { LoginGate } from "./components/LoginGate";
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
  // F011.2: nøgle-gate — null = tjekker, false = login kræves
  const [authed, setAuthed] = useState<boolean | null>(null);
  // F009.1: aktivt brand (null = alle) — filtrerer kø-køen på brandId
  const [activeBrandId, setActiveBrandId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/auth/status")
      .then((r) => r.json())
      .then(({ authed }: { authed: boolean }) => setAuthed(authed))
      .catch(() => setAuthed(true)); // ved API-nedbrud: vis appen (fejler selv)
  }, []);

  if (authed === null) return null;
  if (!authed) {
    return (
      <LoginGate
        onAuthed={() => {
          setAuthed(true);
          setRefreshKey((k) => k + 1);
        }}
      />
    );
  }

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
        {openPost ? (
          // F012.5: story-detaljen er en FULD sheet-visning, ikke en modal
          <StoryDetail
            post={openPost}
            onClose={() => setOpenPost(null)}
            onChanged={(updated) => {
              setOpenPost(updated);
              setRefreshKey((k) => k + 1);
            }}
          />
        ) : view === "calendar" ? (
          <div class="calendar-layout">
            <CalendarView refreshKey={refreshKey} onOpen={setOpenPost} />
            <div class="calendar-rail">
              <NextFive refreshKey={refreshKey} onOpen={setOpenPost} />
              <IdeaPanel refreshKey={refreshKey} />
            </div>
          </div>
        ) : (
          <>
            <BrandSwitcher
              activeBrandId={activeBrandId}
              onSelect={setActiveBrandId}
              refreshKey={refreshKey}
            />
            <QueueBoard
              activeBrandId={activeBrandId}
              refreshKey={refreshKey}
              onOpen={setOpenPost}
            />
            <BrandDrafts onChanged={() => setRefreshKey((k) => k + 1)} />
            <BrandSettings onChanged={() => setRefreshKey((k) => k + 1)} />
          </>
        )}
      </main>
    </div>
  );
}

render(<App />, document.getElementById("app")!);

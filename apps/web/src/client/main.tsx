import { render } from "preact";
import { initTheme } from "@broberg/theme/preact";
import { BrandSettings } from "./components/BrandSettings";
import { QueueBoard } from "./components/QueueBoard";
import "./styles/tokens.css";
import "./styles/app.css";

initTheme({ defaultTheme: "light-warm" });

function App() {
  return (
    <div class="app-shell" data-testid="app-root">
      <header class="app-header" data-testid="app-header">
        <h1>Contentpush</h1>
      </header>
      <main class="app-main" data-testid="app-main">
        <QueueBoard activeBrandId={null} />
        <BrandSettings />
      </main>
    </div>
  );
}

render(<App />, document.getElementById("app")!);

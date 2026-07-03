import { render } from "preact";

function App() {
  return (
    <main data-testid="app-root">
      <h1>Contentpush</h1>
      <p>Scaffold kører — dashboard kommer i F005.</p>
    </main>
  );
}

render(<App />, document.getElementById("app")!);

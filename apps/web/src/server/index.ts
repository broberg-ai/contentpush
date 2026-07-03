import { Hono } from "hono";
import { darkSecrets } from "./env";
import { generateRoute } from "./routes/generate";

for (const [name, consequence] of darkSecrets()) {
  console.warn(`[ship-dark] ${name} ikke sat — ${consequence}`);
}

const app = new Hono();

app.get("/api/health", (c) =>
  c.json({ ok: true, service: "contentpush" }),
);

app.route("/api/generate", generateRoute);

export default app;

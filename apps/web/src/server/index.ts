import { Hono } from "hono";
import { darkSecrets } from "./env";

for (const [name, consequence] of darkSecrets()) {
  console.warn(`[ship-dark] ${name} ikke sat — ${consequence}`);
}

const app = new Hono();

app.get("/api/health", (c) =>
  c.json({ ok: true, service: "contentpush" }),
);

export default app;

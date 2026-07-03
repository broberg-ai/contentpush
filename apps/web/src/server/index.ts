import { Hono } from "hono";
import { darkSecrets } from "./env";
import { generateRoute } from "./routes/generate";
import { brandsRoute } from "./routes/brands";
import { libraryRoute } from "./routes/library";
import { cronHookRoute } from "./routes/cron-hook";
import { postsRoute } from "./routes/posts";
import { packageRoute } from "./routes/package";

for (const [name, consequence] of darkSecrets()) {
  console.warn(`[ship-dark] ${name} ikke sat — ${consequence}`);
}

const app = new Hono();

app.get("/api/health", (c) =>
  c.json({ ok: true, service: "contentpush" }),
);

app.route("/api/generate", generateRoute);
app.route("/api/brands", brandsRoute);
app.route("/api/library", libraryRoute);
app.route("/api/cron", cronHookRoute);
app.route("/api/posts", postsRoute);
app.route("/api/posts", packageRoute);

export default app;

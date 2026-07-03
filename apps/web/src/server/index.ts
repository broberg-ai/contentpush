import { Hono } from "hono";
import { darkSecrets, env } from "./env";
import { generateRoute } from "./routes/generate";
import { brandsRoute } from "./routes/brands";
import { libraryRoute } from "./routes/library";
import { cronHookRoute } from "./routes/cron-hook";
import { postsRoute } from "./routes/posts";
import { packageRoute } from "./routes/package";

for (const [name, consequence] of darkSecrets()) {
  console.warn(`[ship-dark] ${name} ikke sat — ${consequence}`);
}

// Dynamisk import + catch: telemetri-init må aldrig vælte boot
// (0.3.0's ESM-pakkefejl viste præcis dét scenarie; fixet i 0.3.1).
if (env.UPMETRICS_DSN) {
  import("@upmetrics/sdk")
    .then(({ init }) =>
      init({
        dsn: env.UPMETRICS_DSN!,
        environment: env.APP_PUBLIC_URL ? "production" : "development",
      }),
    )
    .catch((err) =>
      console.warn(
        `[upmetrics] init sprang over: ${err instanceof Error ? err.message : err}`,
      ),
    );
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

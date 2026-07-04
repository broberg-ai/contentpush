import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import { darkSecrets, env } from "./env";
import { authRoute, isAuthed } from "./routes/auth";
import { generateRoute } from "./routes/generate";
import { brandsRoute } from "./routes/brands";
import { libraryRoute } from "./routes/library";
import { cronHookRoute } from "./routes/cron-hook";
import { postsRoute } from "./routes/posts";
import { packageRoute } from "./routes/package";
import { calendarRoute } from "./routes/calendar";
import { ideasRoute } from "./routes/ideas";

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

app.route("/api/auth", authRoute);

// F011.2: nøgle-gate på ALT API undtagen health, login/status og cron-hook
// (cron har sin egen CRON_HOOK_SECRET-check). Usat nøgle = inaktiv (dev).
const OPEN_PATHS = new Set([
  "/api/health",
  "/api/auth/login",
  "/api/auth/status",
  "/api/cron/tick",
]);
app.use("/api/*", async (c, next) => {
  if (!env.DASHBOARD_ACCESS_KEY) return next();
  if (OPEN_PATHS.has(new URL(c.req.url).pathname)) return next();
  if (isAuthed(getCookie(c, "cp_session"))) return next();
  return c.json({ error: "Login påkrævet" }, 401);
});

app.route("/api/generate", generateRoute);
app.route("/api/brands", brandsRoute);
app.route("/api/library", libraryRoute);
app.route("/api/cron", cronHookRoute);
app.route("/api/posts", postsRoute);
app.route("/api/posts", packageRoute);
app.route("/api/calendar", calendarRoute);
app.route("/api/ideas", ideasRoute);

export default app;

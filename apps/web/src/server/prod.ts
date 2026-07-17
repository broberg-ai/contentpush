import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import app from "./index";
import { env } from "./env";

// F011.1: prod-entry — Hono serverer både /api/* (app) og SPA-dist statisk.
// Dev kører uændret gennem Vite (vite.config.ts); denne fil bruges KUN i prod.
const prod = new Hono();
prod.route("/", app);
prod.use("*", serveStatic({ root: "./dist" }));
// SPA-fallback: ukendte stier får index.html (client-side routing/refresh)
prod.get("*", serveStatic({ path: "./dist/index.html" }));

console.log(`[prod] contentpush lytter på :${env.PORT}`);

// idleTimeout: Buns default er 10s — for kort til synkron billed-generering
// (LoRA-kald tager 12s+) og til F014.3's AI-video (Kling ~1-2 min, parallelt).
// 240s giver margen; Buns max er 255.
export default { port: env.PORT, fetch: prod.fetch, idleTimeout: 240 };

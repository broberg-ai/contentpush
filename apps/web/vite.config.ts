import { defineConfig } from "vite";
import preact from "@preact/preset-vite";
import devServer from "@hono/vite-dev-server";
import { env } from "./src/server/env";

export default defineConfig({
  plugins: [
    preact(),
    // Hono handles /api/*; everything else (SPA, assets, HMR) stays with Vite.
    devServer({
      entry: "src/server/index.ts",
      exclude: [/^\/(?!api).*/],
    }),
  ],
  server: {
    host: "127.0.0.1",
    port: env.PORT,
    strictPort: true,
  },
});

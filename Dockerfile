# F011.1 — prod-image (Bun). Kontekst: repo-roden (workspace-install).
FROM oven/bun:1 AS app
WORKDIR /app

# Manifester først (docker-layer-cache på installs)
COPY package.json bun.lock ./
COPY apps/web/package.json apps/web/package.json
RUN bun install --frozen-lockfile

# Kildekode + SPA-build
COPY apps ./apps
RUN cd apps/web && bunx vite build

WORKDIR /app/apps/web
ENV NODE_ENV=production
# Migration mod cloud-DB'en køres ved boot (runtime-migratoren er kanonisk sti)
CMD ["sh", "-c", "mkdir -p .data && bun run scripts/migrate.ts && bun src/server/prod.ts"]

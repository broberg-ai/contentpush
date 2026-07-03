# F011 — Deploy: Fly.io (arn) + cron-registrering + adgangsbeskyttelse

> Oprettet på Christians ordre 2026-07-03 efter F005 (v1-kerneflowet komplet lokalt). Formål: gøre 14-dages-rytmen selvkørende — cron-servicen kan ikke nå 127.0.0.1.

## Motivation
Alt i v1 virker lokalt (F001–F005 i Review), men to ting kræver en public URL: (1) cronjobs.webhouse.net skal kunne ramme `/api/cron/tick` dagligt (token er allerede mintet og verificeret, `register-cron.ts` ligger klar ship-dark), og (2) notifikationernes deep-links skal pege på et dashboard Christian kan åbne fra telefonen.

## Arkitektur
- **Fly.io**, region `arn`, org `broberg-ai` (FDS F022-mønstret). App-navn: `contentpush` → `https://contentpush.fly.dev` (custom domæne via buddy/dns-mcp som opfølgning, ikke blokerende).
- **Prod-build:** `vite build` → Hono serverer SPA-dist statisk + `/api/*` (i dag serverer Hono kun API; static-serving er reelt arbejde i F011.1). Bun-runtime i Docker.
- **DB:** Turso cloud-database (provisioneres; `CONTENTPUSH_TURSO_URL/TOKEN` — lokal fil-DB dur ikke på Fly's flygtige disk). Migration køres via `scripts/migrate.ts` mod cloud-DB'en.
- **Secrets** via `flyctl secrets set`: CONTENTPUSH_TURSO_*, CONTENTPUSH_R2_*, MISTRAL_API_KEY, DISCORD_WEBHOOK_URL (når valgt), CRONJOBS_API_TOKEN, CRON_HOOK_SECRET, UPMETRICS_API_KEY (når enrolled), APP_PUBLIC_URL.
- **Auth-gate (husregel: HTTP-services altid auth):** enkel nøgle-gate — custom login-form (aldrig native prompt), adgangsnøgle i secret, session-cookie. Kun Christian er bruger; fuld @broberg/auth er overkill for v1 og kan opgraderes senere.

## Stories
- **F011.1** — Prod-build + Fly-deploy: static-serving, Dockerfile/fly.toml, Turso cloud-DB + migration, secrets, health-probe grøn på public URL.
- **F011.2** — Adgangs-gate: nøgle-login (custom form), alle sider beskyttet, cron-hook via CRON_HOOK_SECRET.
- **F011.3** — Efter-deploy wiring: APP_PUBLIC_URL, cron-job registreret (lukker F004.2's åbne AC), notify-deep-links mod prod, E2E-røgtest af hele rytmen mod prod.

## Non-goals
- Ingen custom domain i denne epic (opfølgning via buddy). Ingen CI/CD-pipeline (F006 ejer CI-gates). Ingen multi-bruger-auth.

## Rollout
Deploy først med gate aktiv → verificér health + login → registrér cron → første rigtige daglige tick overvåges.

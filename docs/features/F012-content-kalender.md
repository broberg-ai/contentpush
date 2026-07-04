# F012 — Bølge 1: Kalenderen + fyldt pipeline (v5)

> **Re-scoped 2026-07-04** efter Christians godkendelse af v5-mockupperne
> (dashboard v3 `019f2a00…`, detaljer v2 `019f2a27…`). Kilde: `docs/PLAN-v5.md`.
> Erstatter det oprindelige F012-scope fuldstændigt.

## Motivation

v1 var en kø — Christian bestilte et SOTA-apparat. Bølge 1 leverer kernen af
v5-oplevelsen: en kalender hvor hvert opslag ligger på sin dato, en pipeline
der selv holder ≥5 færdige stories per brand, billede på HVER story,
platform-tro preview i review, idé-biblioteket som råstof-lag, og
kopiér-til-udklipsholder. Alt genbruger v1-motoren (F001–F005) — det var
motoren; dette er karrosseriet.

## Scope (6 stories)

| Story | Leverer | Mockup-reference |
|---|---|---|
| F012.1 | Kalender-view: måned-grid, story-chips m. thumbnail + brandfarve, brand-pills-filter, klik→detalje | dashboard: `.cal` + `.pills` |
| F012.2 | ≥5-story pipeline-buffer per brand (nat-tick fylder op, idempotent) + pipeline-status-bar | dashboard: `.pipes` |
| F012.3 | Idé-biblioteket: ideas-model + CRUD + UI-panel; generatoren foretrækker Christians idéer | dashboard: idé-panel; detaljer: sektion 1 |
| F012.4 | On-brand billede på hver story (ai.image via ai-sdk → @broberg/media R2 EU) + regenerér | detaljer: sektion 2 medie |
| F012.5 | Platform-tro preview i PostDetail (LinkedIn/IG/FB-faner) | dashboard v2: `.review`; detaljer: `.postmock` |
| F012.6 | Kopiér-til-udklipsholder per platform m. feedback | detaljer: actions |

## Arkitektur-skitse

- **DB**: `ideas` (id, brandId?, rawText VERBATIM, status enum captured|enriched|planned|used|archived, suggestedDate?, usedByPostId?, createdAt) + `posts.ideaId?` + `posts.imagePending` flag. Migration via runtime-migrator (kanonisk sti).
- **API**: `GET /api/calendar?month=` (posts grupperet pr. dato m. thumb-URLs), `POST/GET/PATCH /api/ideas`, `POST /api/posts/:id/regenerate-image`. Buffer-logik ind i eksisterende `/api/cron/tick`.
- **Generator-kontrakt**: prompten får idéens rå tekst verbatim øverst ("Christians idé — byg opslaget på DEN") når en ubrugt idé findes for brandet; ellers auto-headline som i dag. Story refererer `ideaId` → sporbarhed (detalje-mockuppens "Oprindelse").
- **Billeder**: KUN `ai.image` via @broberg/ai-sdk (aldrig rå provider, F033-modellerne opgraderes ind senere via tier — nul ændring her). Fejl = story uden billede + `imagePending`, aldrig væltet generering.
- **UI**: Kalender erstatter QueueBoard som forside; kø-viewet består som sekundær visning. Alle nye interaktive elementer får `data-testid` (F086); Lens-flows verificerer klik-stier (F112).

## Afhængigheder

- ai-sdk F033.1 (Recraft) er IKKE en blocker — `ai.image` i 0.21 dækker; Recraft kommer som tier-opgradering.
- F013 (årshjul+timing) bygger OVENPÅ kalenderen — F012 skal ikke vente på den.

## Non-goals (bevidst udenfor bølge 1)

Årshjul (F013), video (F014), nyhedsbrev (F015), mærkedage/tidsvinduer (F013.3), brand-CRUD-UI (F009), discovery-consumer (F010).

## Rollout

Stories bygges i rækkefølge .1→.6 (kalender først — den er rammen). Hver story: testid-gap-probe 0 + Lens-verifikation før handoff. E2E-seal til sidst: tøm pipeline → tick → 5 stories m. billeder i kalenderen → idé ind → næste story bruger idéen.

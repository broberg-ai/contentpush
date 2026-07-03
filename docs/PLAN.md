# Contentpush — Plan v4

> Tidligere arbejdstitel "Social Content Cockpit". v1/v2 var LinkedIn/IG/FB API-tunge planer lavet før portefølje-tjek. v3 blev støvet af mod `discovery.broberg.ai` (2026-07-03) og lagt på **Stack B** + cardmem's designparadigme. v4 låser navn + to åbne beslutninger.

## 0. Hvad ændrede sig fra v2 til v3

| # | Ændring | Kilde |
|---|---|---|
| 1 | Skifter fra generisk Next.js-stak til **Stack B** (Bun + Hono + Preact + Vite) | din instruks |
| 2 | Designsystem = `@broberg/theme` tokens, **ikke** shadcn/Tailwind — jf. Gravatar Stack B-adapter (`preact`, CSS-class sizing, "no Tailwind/shadcn dep") | Discovery F013 |
| 3 | Genbrug af eksisterende `@broberg/*`-pakker i stedet for at bygge storage/mail/cron/media fra bunden | Discovery `/api` |
| 4 | AI-tekst går gennem `@broberg/ai-sdk` (Mistral), ikke en direkte Anthropic/OpenAI-kaldsstak | brugerhukommelse |
| 5 | Ingen dedikeret social-media-komponent findes i porteføljen — dette bliver et nyt L3/L4-projekt, ikke en genbrug-af-eksisterende-epic | Discovery |

✅ **Designparadigme bekræftet (2026-07-03):** Roligt, varmt look med jordfarver og serif-overskrifter — samme visuelle sprog som cardmem. Ingen shadcn/Tailwind-komponentbibliotek, ren `@broberg/theme`-styling, som antaget i v3.

✅ **Video-scope bekræftet:** v1 = tekst + billeder only. Video tilføjes i v2, når resten kører stabilt.

---

## 1. Koncept (uændret fra v2, bekræftet)

Et internt Stack B-værktøj der hver 14. dag:
1. Genererer post-tekst + hashtags (LinkedIn/Instagram/Facebook-varianter) ud fra en headline + din brand-kontekst
2. Finder/genererer et billede (fra dit stock-bibliotek eller AI-genereret) eller peger på en instruktionsvideo
3. Sender en Discord-webhook-notifikation "klar til gennemsyn" og senere "tid til at poste"
4. Præsenterer alt i en dashboard-kø, du kan downloade som pakke (tekst + medie) og poste manuelt

**Ingen** LinkedIn/Instagram/Facebook API-integration — du poster selv. Det eliminerer compliance-risiko og API-godkendelsesproces helt.

---

## 2. Komponent-mapping — genbrug vs. nybyg

Bekræftet direkte fra `discovery.broberg.ai`:

| Behov | Pakke | Status | Noter |
|---|---|---|---|
| Design tokens / tema | `@broberg/theme` v0.3.1 | ✅ shipped | Kilden til farver/typografi — "denne side renderer med de tokens den dokumenterer" |
| Stack B scaffold | `@broberg/stack-b-base` | 🚧 under construction | Endnu ikke shippet — vi bootstrapper manuelt efter samme konventioner (Bun+Hono+Preact+Vite) og migrerer når pakken lander |
| Config | `@broberg/config` v0.2.0 | ✅ shipped | Single-source env/config helper |
| Mail (fallback-kanal) | `@broberg/mail` v0.3.0 | ✅ shipped | Kun relevant hvis du senere vil have e-mail som backup til Discord. NB: v0.3.0 kræver eksplicit `MAIL_LIVE=true` i prod — ellers ship-dark |
| Medielagring | `@broberg/media` v0.1.0 | ✅ shipped | Provider-agnostic storage — bruges til dit stock-billedbibliotek + AI-genererede billeder + instruktionsvideoer |
| Billedtransform | `@broberg/media-transform` v0.1.0 | ✅ shipped | HEIC→WebP, responsive størrelser — kør alle uploadede/AI-genererede billeder igennem inden de lander i download-pakken |
| Scheduling / 14-dages trigger | `@broberg/cron` v0.1.0 | ✅ shipped | Klient til `cronjobs.webhouse.net` — erstatter en hjemmelavet cron-løsning |
| Push-notifikationer | `@broberg/webpush` v0.1.0 | ✅ shipped | Dækker **ikke** Discord — kun PWA/browser push. Kan tilføjes som ekstra kanal senere, men Discord bliver et rent webhook-kald (se §5) |
| Rate-limit / adgangskontrol | `@broberg/apikey` v0.1.1 | ✅ shipped | Kun relevant hvis dashboardet skal have flere brugere/roller senere |
| Auth (hvis flere brugere) | `@broberg/auth` v0.1.1 | ✅ shipped | Better Auth-wrapper — samme pakke cardmem selv bruger. Kun nødvendig hvis værktøjet skal have login (sandsynligvis ikke, det er kun dig) |
| Secrets-scanning | `@broberg/secret-scan` v0.1.5 | ✅ shipped | Kør i CI, så Discord-webhook-URL eller AI-nøgler aldrig committes |
| AI-tekstgenerering | `@broberg/ai-sdk` v0.17.1 | ✅ shipped | Mistral (EU) til prosa/hashtag-generering — jeres eneste model-boundary |
| Database | `@broberg/db-sdk` v0.1.0 | ✅ shipped | Turso/libSQL — ét enkelt-tenant DB er nok her (ingen database-per-tenant-arkitektur nødvendig, det er kun dig som bruger) |
| Omkostningssporing | `@upmetrics/sdk` v0.2.0 | ✅ shipped | Log AI-genereringsomkostninger (tekst + evt. billede) samme mønster som F113 |

**Findes ikke i porteføljen — skal bygges fra bunden i dette projekt:**

| Behov | Plan |
|---|---|
| Discord/Slack-notifikation | 🔜 `@broberg/notify` (Discord + Slack i samme pakke) er under udvikling. **Contentpush venter med notify-integrationen til pakken lander** i stedet for at bygge en engangsløsning der skal udskiftes. Indtil da: rå `fetch()` til webhook som midlertidigt stub (se §5), klart markeret som "erstat med `@broberg/notify` når tilgængelig" |
| AI-billedgenerering | `@broberg/ai-sdk` er LLM/tekst-fokuseret — der er **ingen** billedgenererings-pakke i inventoryet. Skal afklares: Mistral har ikke førsteparts billedgenerering; mulige veje er (a) DeepInfra (allerede i jeres ai-sdk model-boundary til "cheap/ingest") hvis de tilbyder en billedmodel, eller (b) en separat ekstern provider uden for `ai-sdk`-grænsen — det sidste bryder jeres "ét model-boundary"-princip, så det bør besluttes bevidst, ikke ved en stille undtagelse |
| Instruktionsvideo-håndtering | Ingen video-transform-pakke fundet. Antagelse: du optager/redigerer selv videoerne, og værktøjet håndterer dem kun som rå filer via `@broberg/media` (upload, lagring, download) — ingen auto-generering af video |
| Content-generation UI (kort/kø-visning) | Nybyg, cardmem-kortbaseret paradigme — ✅ bekræftet (jordfarver, serif, ren `@broberg/theme`, intet shadcn) |

---

## 3. Arkitektur (Stack B)

```
social-content-cockpit/       # repo-navn kan opdateres til fx contentpush/ når vi scaffolder
├── apps/
│   └── web/                      # Bun + Hono server + Preact SPA
│       ├── src/
│       │   ├── server/
│       │   │   ├── index.ts      # Hono app entry
│       │   │   ├── routes/
│       │   │   │   ├── posts.ts       # CRUD for planlagte posts
│       │   │   │   ├── generate.ts    # AI-tekst + billede-generering
│       │   │   │   ├── library.ts     # Stock-billedbibliotek
│       │   │   │   ├── discord.ts     # Webhook-afsender
│       │   │   │   └── cron-hook.ts   # Modtager kald fra @broberg/cron
│       │   │   └── db/
│       │   │       └── schema.ts      # Drizzle-schema (Turso)
│       │   └── client/
│       │       ├── main.tsx           # Preact entry
│       │       ├── components/
│       │       │   ├── PostCard.tsx       # cardmem-paradigme
│       │       │   ├── QueueBoard.tsx     # kanban-lignende kø
│       │       │   ├── LibraryGrid.tsx
│       │       │   └── DownloadPackage.tsx
│       │       └── styles/
│       │           └── tokens.css         # fra @broberg/theme
├── .env                           # DotEnv — aldrig committet
└── package.json
```

**Kerneflow:**

```
@broberg/cron (14-dages trigger)
        │
        ▼
  cron-hook.ts ──► genererer post-udkast via @broberg/ai-sdk (Mistral)
        │                │
        │                ▼
        │         vælger/genererer billede (@broberg/media + media-transform)
        │
        ▼
  Discord webhook: "🎨 Nyt udkast klar til gennemsyn"
        │
        ▼
  Du åbner dashboard → godkender/regenererer → "Marker klar"
        │
        ▼
  Discord webhook: "✅ Tid til at poste i dag"
        │
        ▼
  Du downloader pakke (zip: linkedin.txt, instagram.txt, facebook.txt, media/)
        │
        ▼
  Du poster manuelt → "Marker som postet" → næste post auto-planlægges +14 dage
```

---

## 4. Database-skema (Turso via `@broberg/db-sdk`)

```typescript
// Enkelt-tenant — ingen database-per-tenant nødvendig for dette værktøj

posts {
  id
  headline
  companyContext        // din intro-tekst, genbrugt på tværs af posts
  linkedinText
  instagramText
  facebookText
  hashtags              // json array, per platform
  mediaType              // 'stock' | 'ai-generated' | 'video'
  mediaId                // fk → media_library
  status                 // 'draft' | 'ready' | 'posted'
  scheduledDate
  postedAt
  createdAt
}

media_library {
  id
  url                     // @broberg/media storage reference
  type                    // 'stock-image' | 'ai-image' | 'video'
  tags
  description
  createdAt
}

settings {
  companyIntro
  brandVoice
  discordWebhookUrl        // .env, ikke DB, men refereret her for klarhed
  postingIntervalDays      // default 14
}
```

---

## 5. Notifikation — midlertidig stub, erstattes af `@broberg/notify`

⚠️ `@broberg/notify` (Discord + Slack samlet) er under udvikling og bør bruges så snart den er tilgængelig. Koden herunder er en **midlertidig stub**, ikke den endelige løsning — hold koblingen løs (én funktion, ét ansvar), så udskiftningen bliver triviel.

```typescript
// apps/web/src/server/routes/discord.ts
// MIDLERTIDIG — erstat med @broberg/notify når pakken lander
import 'dotenv/config';

async function notifyDiscord(message: string) {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) {
    console.warn('DISCORD_WEBHOOK_URL not set — skipping notify (ship-dark)');
    return { ok: false, skipped: true };
  }

  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: message }),
  });

  return { ok: res.ok, status: res.status };
}
```

Ship-dark-mønsteret er bevidst lånt fra `@broberg/mail` (aldrig crashe et flow hvis nøgle/URL mangler, bare log og fortsæt) — konsistent med resten af porteføljen, og genkendeligt når `@broberg/notify` overtager.

---

## 6. Åbne beslutninger

1. ~~AI-billedgenerering — provider~~ → **Genbesøges når planen konstrueres i Cardmem**, ikke her.
2. ~~Designparadigme-bekræftelse~~ ✅ Afklaret 2026-07-03 — ren `@broberg/theme`, intet shadcn/Tailwind.
3. ~~Navn~~ ✅ **Contentpush**
4. ~~Cardmem-registrering~~ → Christian opretter repo + projekt manuelt i Cardmem — **ikke** noget jeg skal gøre.
5. ~~`@broberg/discord-notify`~~ → Bortfalder — `@broberg/notify` (Discord + Slack) er allerede på vej, se §2 og §5.

---

## 7. Fase-plan

| Fase | Indhold | Afhænger af |
|---|---|---|
| **P1 — Scaffold** | Stack B-projekt manuelt sat op (indtil `@broberg/stack-b-base` shipper), `@broberg/theme` tokens indlejret, Turso-DB + Drizzle-schema | — |
| **P2 — Content generation** | `@broberg/ai-sdk`-integration for tekst+hashtags, company-context input-formular | P1 |
| **P3 — Media** | `@broberg/media` + `media-transform` for stock-bibliotek + upload; AI-billedgenerering (afhænger af §6.1) | P1 |
| **P4 — Discord + Cron** | Webhook-afsender, `@broberg/cron`-integration for 14-dages trigger | P1 |
| **P5 — Dashboard UI** | Kort/kø-visning i cardmem-paradigme, download-pakke (zip) | P2, P3 |
| **P6 — Polish** | `@broberg/secret-scan` i CI, `@upmetrics/sdk` omkostningslog | Alle |

---

## 8. Roadmap ud over v1 — automatiseret posting

**v1 (denne plan):** Manuel posting. Du downloader pakken og poster selv — nul API-risiko, nul godkendelsesproces.

**v2 — automatiseret posting via Lens (Playwright):** I stedet for at søge officiel API-adgang til LinkedIn/Instagram/Facebook fra start, afprøves direkte posting via `@broberg/lens` (samme Playwright + pixelmatch-stack som allerede bruges i Storeform til App Store Connect-formularer). Fordel: undgår API-godkendelse og rate-limits, genbruger eksisterende infrastruktur og mønster. Ulempe: skrøbeligt over for UI-ændringer på platformene, kræver visuel verifikation (Lens' kernekompetence) for at bekræfte at posts rent faktisk blev sendt korrekt.

**v3 — officiel API (hvis nødvendigt):** Hvis Lens-baseret automation viser sig for skrøbelig i praksis (platform-UI-ændringer, bot-detektion), evalueres officiel API-integration (LinkedIn Share API, Meta Graph API) som beskrevet i de oprindelige v1/v2-udkast. Betragtes som fallback, ikke førstevalg.

**Rækkefølge:** v1 bygges og bruges færdigt først. Lens-eksperimentet i v2 startes som en isoleret spike, ikke en big-bang-migrering — dashboardet fra v1 forbliver brugbart som manuel fallback uanset udfaldet.

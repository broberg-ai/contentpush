# Contentpush

Internt værktøj der hver 14. dag gør det nemt at holde WebHouse's tilstedeværelse på LinkedIn, Instagram og Facebook ved lige — uden det administrative bøvl.

## Hvad det gør

1. Genererer post-tekst + hashtags (platform-tilpasset) ud fra en headline + din brand-kontekst
2. Finder eller genererer et billede i din visuelle stil (stock-bibliotek eller AI)
3. Sender en notifikation når et udkast er klar, og igen når det er tid til at poste
4. Du gennemgår, godkender/regenererer i dashboardet, og downloader en pakke (tekst + medie)
5. Du poster manuelt — næste post planlægges automatisk +14 dage

**v1 = manuel posting.** Ingen LinkedIn/Meta API-integration endnu — se roadmap.

## Stack

Stack B: Bun + Hono + Preact + Vite, styling via `@broberg/theme` (intet shadcn/Tailwind — samme designsprog som Cardmem).

| Behov | Pakke |
|---|---|
| AI-tekst | `@broberg/ai-sdk` (Mistral) |
| Medielagring + transform | `@broberg/media`, `@broberg/media-transform` |
| Scheduling | `@broberg/cron` |
| Database | `@broberg/db-sdk` (Turso) |
| Notifikation | `@broberg/notify` (Discord + Slack) — midlertidig webhook-stub indtil pakken lander |
| Omkostningslog | `@upmetrics/sdk` |

## Kom i gang

```bash
git clone <repo>
cd contentpush
bun install
cp .env.example .env   # udfyld DISCORD_WEBHOOK_URL, AI-nøgler, DB-connection
bun run dev
```

## Struktur

```
apps/web/
├── src/server/     # Hono API — posts, generate, library, notify, cron-hook
├── src/client/      # Preact dashboard — kortbaseret kø, cardmem-paradigme
└── src/server/db/   # Drizzle-schema (Turso)
```

## Status & roadmap

- **v1** (i gang): tekst + billeder, manuel posting
- **v2**: automatiseret posting via `@broberg/lens` (spike, ikke big-bang)
- **v3**: officiel platform-API kun hvis Lens viser sig for skrøbel
- **v2+**: instruktionsvideoer

# F010 — Brand Discovery: forbrug AutoDocs discovery-engine

> **Arkitektur-beslutning (Christian, 2026-07-03):** AutoDoc EJER discovery-motoren; contentpush FORBRUGER den via AutoDocs API og kommer med input til kontrakten. Én motor i flåden, ikke to crawlers (reuse-first). Erstatter den oprindelige plan om egen analyzer-engine. Depends on F009 + AutoDocs consumer-endpoint.

## Motivation
Med multi-brand (F009) skal hvert nyt site/produkt have en brand-profil før Contentpush kan poste for det. Informationen findes allerede — og AutoDoc har allerede en discovery-motor (F001.2, bygget: funktionel model via repo + live-URL + ai-sdk vision) plus ToneVault (voice/tone-dokumenter). I stedet for at genopfinde crawl+analyse bygger AutoDoc et **brand-signal-lag** oven på deres Discovery og eksponerer det via deres API (OpenAPI 3.1); contentpush mapper svaret til en kladde-brand-profil.

## Seam (låst via intercom #15691→#15695, 2026-07-03)
- **AutoDoc leverer:** funktionel model (ruter/entiteter/flows/README-summary/UI-surface) + `brand_signals` { voice, tone[], audience, themes[], visual_style_notes, language, platform_cues[{platform, fit, rationale}], suggested_posting_interval_days + rationale } + grounding (manual-/guide-uddrag) + `analyzed_at` + re-analyse-trigger.
- **Auth:** per-projekt bearer (AutoDocs F001.7), read-only. Token i contentpush's .env, projekt-præfikset, ship-dark.
- **Targets:** altid Christians egne produkter (repo + live-URL) → AutoDocs enrolled-mode dækker v1. URL-only-crawl er en NOTERET senere AutoDoc-udvidelse — bygges ikke nu.

## Flow
```
Christian vælger target-produkt (enrolled i AutoDoc)
        ▼
contentpush kalder AutoDocs consumer-endpoint (bearer)
        ▼
map: funktionel model + brand_signals + grounding → KLADDE i brand_profiles
        ▼
Christian reviewer/redigerer/godkender i dashboardet (F010.2)
        ▼
aktiv profil driver post-generering (voice/platforme/interval)
```

## Non-goals
- INGEN egen crawler, Lens-orkestrering eller vision-pass i contentpush — alt discovery-arbejde sker hos AutoDoc.
- Ingen auto-aktivering af profiler.

## Dependencies
- F009 (brand_profiles er målet). AutoDocs consumer-endpoint + brand-signal-lag (de bygger — blocked indtil de melder klar).

## Stories
- **F010.1** — AutoDoc-consumer: hent discovery + brand-signaler → kladde-brand-profil (kørt mod de 3 første brands).
- **F010.2** — Review/godkend-flow i dashboardet + berigelse.

# F010 — Brand Discovery analyzer

> Ny feature fra Christian 2026-07-03 (under adoption): "tænk en Discovery mode/analyzer ind i dit tekniske setup som gør at jeg sender dig hen mod et eksisterende site eller et produkt du skal gennemgå (evt. med Cardmem Lens) for at lave en analyse og marketing tone/voice/platform for hvilken retning du skal gå med dine posts." Depends on F009.

## Motivation
Med multi-brand (F009) skal hvert nyt site/produkt have en brand-profil før Contentpush kan poste for det. At håndskrive tone/voice/platform-valg per brand skalerer ikke over porteføljen — og informationen FINDES allerede på det levende site. Analyzeren gør onboarding af et nyt brand til: indtast URL → få et kvalificeret forslag → godkend/justér.

## Flow
```
Christian angiver URL/produkt
        │
        ▼
Analyzer: henter indhold (tekst/struktur) + Lens-captures (visuelt indtryk)
        │           evt. berigelse: produktdata fra cms / cardmem
        ▼
@broberg/ai-sdk → struktureret analyse:
  tone, voice, temaer, visuel stil-noter, platform-anbefaling (fx "LinkedIn primær, IG sekundær")
        │
        ▼
KLADDE brand-profil (draft) i brand_profiles — aldrig auto-aktiv
        │
        ▼
Christian reviewer/redigerer/godkender i dashboardet → profil aktiv → posts kan genereres
```

## Integrationer
- **Cardmem Lens** til visuelle captures (F112: aldrig rå Playwright). Mangler Lens en capability → filér lens-gap, ikke workaround.
- **cms / cardmem**: hvor sitet/produktet er kendt i økosystemet, berig analysen med produktdata (navn, beskrivelse, positionering).
- **@broberg/ai-sdk** til selve analysen; cost logges via upmetrics.

## Non-goals
- Ingen auto-aktivering af profiler; ingen konkurrent-analyse/SEO-audit; ingen scraping bag login i v1.

## Dependencies
- F009 (brand_profiles er målet). F001–F002 (ai-sdk-integration eksisterer).

## Stories
- **F010.1** — Analyzer-engine: URL → indhold+Lens-capture → ai-sdk → kladde-brand-profil.
- **F010.2** — Review/godkend-flow i dashboardet + cms/cardmem-berigelse.

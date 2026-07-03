# F009 — Multi-brand: Contentpush for alle Christians projekter

> Scope-udvidelse fra Christian 2026-07-03 (under adoption, efter Plan v4): Contentpush er IKKE kun WebHouse — det skal kunne anvendes til ALLE hans sites/produkter, hver med egen brand voice/tone/platforme. Arbejder tæt sammen med cms og cardmem. Depends on F001.

## Motivation
Plan v4 antog ét brand (WebHouse, singleton `settings`). Christian har afklaret at Contentpush skal drive social-posts for hele porteføljen — hvert site/produkt med sin egen tone, sine egne platforme og sin egen visuelle stil. Uden brand-profiler som førsteklasses begreb ville alt (generering, cron, notify, download, billedstil) skulle re-arkitekteres senere. Derfor: brand_profiles i skemaet fra dag ét (F001.3 opdateret), og denne epic bygger fladen ovenpå.

## Datamodel (erstatter Plan v4 §4's singleton-settings-antagelse)
```
brand_profiles {
  id, name, siteUrl
  companyContext        // brand-kontekst der før lå globalt i settings
  brandVoice            // tone/voice-beskrivelse
  platforms             // json: hvilke platforme dette brand poster til
  postingIntervalDays   // per brand (default 14)
  personaPolicy         // 'brand-only' | 'portrait-allowed'
  loraId                // per-brand stil-LoRA (nullable indtil trænet)
  createdAt
}
posts.brandId → brand_profiles.id   // hver post tilhører ét brand
settings                              // beholdes til app-globale værdier alene
```

## GDPR / persona (afklaret 2026-07-03)
- Brand-visuals/illustrationer: `ai.trainStyle` per brand — træningssæt SKAL være brand-only (træning kører på fal.ai/US).
- Billeder med Christian: BFL EU portrait path (`ai.image({referenceImages})`) — eksplicit samtykke givet skriftligt 2026-07-03. Aldrig ansigter i trainStyle.

## Scope
- Brand-profil CRUD + brand-vælger i dashboardet; post-køen scopes af valgt brand.
- Brand-scoping hele vejen: generering læser brandets voice/kontekst/platforme; cron kører per brand-interval; notifikationer nævner brand; download-pakken indeholder brandets platforme.
- Per-brand billedstil: loraId + personaPolicy på profilen.

## Non-goals
- Ingen multi-BRUGER/auth — stadig kun Christian.
- Ingen automatisk brand-analyse — det er F010 (Discovery analyzer), som producerer KLADDE-profiler til denne models tabeller.

## Dependencies
- F001 (skema + shell). F010 bygger ovenpå denne. Berører F002 (generering læser brand-profil i stedet for global settings), F004 (cron/notify per brand), F005 (kø + vælger).

## Stories
- **F009.1** — Brand-profil CRUD + brand-vælger i dashboardet.
- **F009.2** — Brand-scoping gennem generering, cron, notify og download.
- **F009.3** — Per-brand billedstil: LoRA-træning + persona-politik.

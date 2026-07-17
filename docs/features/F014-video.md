# F014 — Bølge 3: Video + polish

> Oprettet 2026-07-04 ved v5-re-planlægningen. Kilde: `docs/PLAN-v5.md` bølge 3 + detalje-mockuppens story-sektion (video-preview, 16:9 + 9:16 Reels-udgave, fallback-billede).

## Motivation

Christians SOTA-krav: "jeg vil have små videoer". Video løfter rækkevidden markant på alle tre platforme, men er dyrest og mest umodent — derfor spike først.

## Q3 — AFGJORT (2026-07-17): HYBRID

Spiken (F014.1) producerede et matchet 2×2 (samme on-brand still) og Christian valgte på evidens:

- **AI-klip** (Kling 2.5 Turbo Pro i2v via `ai.animate`, blessed fal-rute i ai-sdk 0.23.0, FAL_KEY-only): $0.35/5s-klip, ~62s gen, 1080p ægte generativ bevægelse. Wow, men per-klip-pris skalerer.
- **Skabelon-animation** (lokal ffmpeg-søm `lib/videoRender.ts`, Ken Burns + tekst-fade): $0, ~5s render, on-brand + styrbar, men "levende billede".

**Valg = HYBRID:** skabelon som DEFAULT på alle opslag (gratis, on-brand, tekst indbygget, skalerer), AI-klip SELEKTIVT på hero-opslag hvor bevægelsen bærer (lanceringer, mærkedage, kampagne-højdepunkter). Driver F014.2's scope. Åbent under-spørgsmål til F014.2: markeres "video-værd" manuelt pr. opslag/aktivitet eller auto-foreslået?

## Stories

- **F014.1 Spike**: producer 2×2 eksempler (AI-klip + template-animation, 16:9 + 9:16) for én rigtig story; dokumentér pris/kvalitet/produktionstid; Christian vælger retning. AL video-generering via ai.video (@broberg/ai-sdk) — aldrig rå provider.
- **F014.2 Video på stories**: efter valget — nat-ticket genererer video hvor story-typen bærer det (markeret i idé/aktivitet), 16:9 + 9:16-udgaver, fallback-billede altid, video-preview i platform-preview'et, med i download-pakke + kopiér-flow.

## Noter

- Voiceover: findes ikke i ai-sdk endnu — gap files til components når F014.2 starter (jf. indstillinger-mockup).
- Undertekster: ai.transcribe når speak findes; indbrændte captions (SoMe ses uden lyd).
- Video-render/-transform: AFKLARET (components intercom 17794) — @broberg/media-transform er sharp-baseret billed-transform, ffmpeg-video hører ikke hjemme der. Skabelon-renderen bygget LOKALT bag en tynd, indkapslet ffmpeg-søm (`apps/web/src/server/lib/videoRender.ts`), blessed til spiken; ekstraktion til delt `@broberg/video-render` tracked (cardmem-idé 019f6ffb) når consumer #2 melder sig (rule-of-three).
- Composite promo-video (Christians idé 2026-07-17, cardmem-idé 019f71ab): ægte UI-optagelse (Lens driver app'en) + logo + AI-B-roll stitched. UI-video-optagelse = Lens-gap (verificeres med lens-holdet, intercom 17928); stitching genbruger sømmen. Kandidat til egen F-feature el. F014.2-udvidelse.

## Afhængigheder

F012 (story-pipeline + medie-flow). Starter efter Christians Q3-svar eller som spike på hans GO.

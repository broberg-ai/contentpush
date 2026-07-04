# F014 — Bølge 3: Video + polish

> Oprettet 2026-07-04 ved v5-re-planlægningen. Kilde: `docs/PLAN-v5.md` bølge 3 + detalje-mockuppens story-sektion (video-preview, 16:9 + 9:16 Reels-udgave, fallback-billede).

## Motivation

Christians SOTA-krav: "jeg vil have små videoer". Video løfter rækkevidden markant på alle tre platforme, men er dyrest og mest umodent — derfor spike først.

## Åbent spørgsmål (Q3, ubesvaret)

Generative AI-klip (ai.video) vs template-baserede animationer (billede+tekst+motion). Spiken producerer eksempler af begge til samme story så Christian kan vælge på evidens (pris + kvalitet side om side).

## Stories

- **F014.1 Spike**: producer 2×2 eksempler (AI-klip + template-animation, 16:9 + 9:16) for én rigtig story; dokumentér pris/kvalitet/produktionstid; Christian vælger retning. AL video-generering via ai.video (@broberg/ai-sdk) — aldrig rå provider.
- **F014.2 Video på stories**: efter valget — nat-ticket genererer video hvor story-typen bærer det (markeret i idé/aktivitet), 16:9 + 9:16-udgaver, fallback-billede altid, video-preview i platform-preview'et, med i download-pakke + kopiér-flow.

## Noter

- Voiceover: findes ikke i ai-sdk endnu — gap files til components når F014.2 starter (jf. indstillinger-mockup).
- Undertekster: ai.transcribe når speak findes; indbrændte captions (SoMe ses uden lyd).
- Video-transform (klip 16:9→9:16): afklar med components om @broberg/media-transform skal udvides (reuse-first) — INGEN lokal ffmpeg-rulning uden gap-dialog.

## Afhængigheder

F012 (story-pipeline + medie-flow). Starter efter Christians Q3-svar eller som spike på hans GO.

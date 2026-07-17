# F016 — Drejebog / scripted promo-video

> Oprettet 2026-07-17. Kilde: Christians ønske om at bygge redigerbare video-scripts (drejebøger) i Contentpush → send til motoren → færdig promo-video med speak (da/en) + valgfri time-synced captions. Godkendt mockup: **019f71db** (drejebog-editor). Research: cardmem-asset "Drejebog-til-AI-video-research.md". Idé: 019f71b2.

## Motivation

En professionel promo-video med speak bygges IKKE af én prompt, men af en **pipeline**: en redigerbar drejebog → pr. scene [billede/klip + speak + tekst + musik] → stitch. Denne epic bygger drejebogen (skrive/rette-fladen + datamodel + AI-udkast) FØRST; selve video-kompileringen er en separat, delvist blokeret fase.

## Scope (denne epic)

**F016.1 — Drejebog-editor (dette kort, mockup-48dcd014):** editoren fra den godkendte mockup — opret/rediger en drejebog (scener med rolle, visual-kilde, speak da/en, skærmtekst, transition), auto-varighed fra speak-ordtal, AI-"Foreslå manus", persistering. Valgfri musik (default FRA). "Byg video" er markeret "kommer".

Planlagte følge-stories (oprettes når F016.1 er i hus / deps letter):
- **F016.2 — Kompilér-pipeline:** drejebog → speak (ai.tts da/en) + captions (align af kendt tekst mod TTS-lyd) + b-roll/stills → stitch via `lib/videoRender.ts` (udvidet m. concat + audio + burn-in) → mp4 pr. sprog × format. **BLOKERET** på: UI-optagelse (Lens record-flow, lens-gap 019f71ac) + musik-hylde.
- **F016.3 — Musik-hylde:** kurateret royalty-free bibliotek (Christian plukker fra Pixabay) + per-video valgfrit spor.

## Non-goals

- Ægte video-output i F016.1 (det er F016.2 — blokeret). Editoren gemmer en drejebog; "Byg video" er dark indtil pipelinen står.
- AI-musik-generering (gratis-ruten = kurateret Pixabay-hylde, F016.3).
- Veo-3-native-audio premium-motor (senere beslutning).

## Arkitektur

- **Datamodel (Drizzle→Turso via @broberg/db-sdk):** `video_scripts` (id, brandId→brand_profiles, title, aspect, languages json, targetDurationSec, musicEnabled default 0, musicTrackId?, status, createdAt) + `video_scenes` (id, scriptId→video_scripts, order, role, visualType["ai-broll"|"ui-capture"|"still"|"logo"], visualPrompt?, flowRef?, mediaId?, voiceoverDa, voiceoverEn, onScreenText?, transition). Scene-varighed beregnes (ord÷150) — ikke lagret, afledt.
- **Server (`apps/web/src/server/routes/scripts.ts`):** CRUD for scripts+scenes; `POST /:id/suggest` = AI-manus via `ai.chat` (@broberg/ai-sdk — ALDRIG rå provider), hook→problem→løsning→bevis→CTA fra brand-kontekst.
- **Client (`apps/web/src/client/`):** ny "Drejebog"-view + komponenter (DrejebogEditor, SceneCard, VisualPicker, VoEditor, PreviewRail) jf. mockup 019f71db, på @broberg/theme-tokens (light-warm, jordfarver, serif). Alle interaktive elementer får kebab-case `data-testid` (F086). Custom controls — ingen native select/dialog.

## Acceptance criteria

Se kortets AC (F016.1).

## Afhængigheder

F012 (medie/story-flow), F014 (`lib/videoRender.ts`-sømmen, ai.animate). F016.2 blokeret på Lens record-flow (019f71ac) + F016.3.

## Reuse (F217)

- **AI:** `@broberg/ai-sdk` — `ai.chat` (manus-udkast), senere `ai.tts` (da/en speak: ElevenLabs+Azure), `ai.transcribe`/WhisperX (caption-align), `ai.animate` (b-roll). ALDRIG rå provider.
- **DB:** `@broberg/db-sdk` (Turso). **Tema:** `@broberg/theme` tokens. **Video-render:** lokal `lib/videoRender.ts`-søm (components-blessed, ekstraktion→@broberg/video-render tracked 019f6ffb).
- **Musik:** ingen `@broberg/*`-primitiv; gratis-rute = kurateret Pixabay-hylde (F016.3). Intet rå-provider-hul.

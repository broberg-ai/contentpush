# F016 — Drejebog / scripted promo-video

> Oprettet 2026-07-17. Kilde: Christians ønske om redigerbare video-scripts (drejebøger) i Contentpush → kompilér til færdig promo-video med speak (da/en) + valgfri time-synced captions + valgfri musik. Godkendt mockup: **019f71db**. Research: cardmem-asset "Drejebog-til-AI-video-research.md". Idé: 019f71b2.

## Motivation

En professionel promo-video med speak bygges IKKE af én prompt, men af en **pipeline**: en redigerbar drejebog → pr. scene [billede/klip + speak + tekst + musik] → stitch. Editoren (F016.1) står; denne fase (F016.2) gør "Byg video"-knappen levende.

## Stories

- **F016.1 — Drejebog-editor** ✅ (Review, live): opret/rediger drejebøger (scener: rolle, visual-kilde, speak da/en, skærmtekst, transition), auto-varighed ÷150 wpm, AI-"Foreslå manus", persistering. "Byg video" var dark.
- **F016.2 — Kompilér-pipeline ("Byg video" → færdig mp4)** — DENNE fase. Se design + scope nedenfor.
- **F016.4 — Tids-synkede undertekster + begge sprog** (følge-story): burn-in captions align'et mod TTS-lyden (Christians "synlig transcription time synced"-krav) + producer BÅDE da- og en-udgave. Adskilt fordi caption-synk + sprog-matrix er sit eget testbare lag.
- **F016.3 — Musik-hylde** (følge-story): kurateret royalty-free bibliotek (Pixabay) + per-video valgfrit spor; mixes ind i compile når et spor er valgt. Musik default FRA (Christians beslutning).

## F016.2 — compile-pipeline (scope + design)

**Vertikal MVP denne fase:** "Byg video" producerer en **rigtig speaket mp4** for det **valgte sprog** i drejebogens **format** (aspect). Pr. scene: materialisér et visual (for scenens VO-varighed) + generer VO-lyd → concat alle scener + mux VO → én mp4. Knappen bliver levende; resultatet kan afspilles/hentes.

**Pr. scene-visual (visualType):**
- `still` → `ai.image(visualPrompt)` → Ken Burns-klip (videoRender-søm) i VO-varigheden.
- `ai-broll` → `ai.image(visualPrompt)` → `ai.animate` (fal/Kling) → klip.
- `logo` → brand-logo-kort (still → Ken Burns). (Brand-logo-kilde: brandProfiles; fallback = brand-navn på farvet kort.)
- `ui-capture` → **UDSKUDT** (Lens record-flow, gap 019f71ac). Compile springer scenen med et tydeligt "afventer Lens-optagelse"-placeholder-kort (ingen crash).

**Tale:** `ai.tts` (da/en; ElevenLabs danske stemmer / Azure SSML da-DK) pr. scene fra `voiceoverDa`/`voiceoverEn`. VO-lydens længde driver scenens klip-varighed (ikke det anslåede ÷150-tal — den rigtige lyd vinder).

**Stitch:** `lib/videoRender.ts`-sømmen UDVIDES (stadig én indkapslet ffmpeg-kilde) med (a) still→klip-af-vilkårlig-varighed uden headline-overlay, (b) concat af N klip, (c) mux af en samlet VO-lydspor. Resultatet lagres i R2 + media_library (type video) og kan hentes.

**Eksekvering:** compile er langt (flere AI-kald + ffmpeg, minutter). Køres med `videoScripts.status`/en compile-tilstand; UI viser fremgang. idleTimeout allerede 240s (F014.3). Ved mange scener kan totalen overstige én request — MVP kapper til korte drejebøger (≤5 scener) og logger hvis kappet.

**Non-goals i F016.2:** captions (F016.4), begge-sprog-matrix i ét kald (F016.4), musik-mix (F016.3), ui-capture-scener (Lens-gap), Veo-native-audio.

## Datamodel-tillæg

Compile-output pr. sprog×format: genbrug `post_videos`-mønsteret er til opslag; drejebøger får deres eget. Minimal: en `video_script_renders` (scriptId, language, aspect, mediaId→media_library video, status, createdAt) ELLER et felt på scriptet. MVP: én render ad gangen — gem `video_scripts.renderMediaId` + `renderStatus` (afklares i build; hold additivt).

## Reuse (F217)

Tjekket: alt via `@broberg/ai-sdk` — `ai.chat` (manus), `ai.image` (scene-still), `ai.animate` (b-roll), `ai.tts` (da/en speak), `ai.transcribe` (F016.4 caption-align). Bekræftet i 0.23.0's typer: `ai.tts` (ElevenLabs/Azure, da-DK) + `ai.transcribe` findes. Stitch = lokal `videoRender.ts`-søm (blessed; ekstraktion→@broberg/video-render tracked 019f6ffb). Musik: ingen fleet-primitiv → Pixabay-hylde (F016.3). Ingen rå provider.

## Afhængigheder

F016.1 (editor + datamodel), F014 (`videoRender.ts`-søm + ffmpeg-på-prod + `ai.animate`). F016.2's ui-capture-scenetype blokeret på Lens record-flow (019f71ac) — udskudt, ikke blokerende for resten.

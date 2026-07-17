# F014 — Bølge 3: Video + polish

> Oprettet 2026-07-04 ved v5-re-planlægningen. Kilde: `docs/PLAN-v5.md` bølge 3 + detalje-mockuppens story-sektion (video-preview, 16:9 + 9:16 Reels-udgave, fallback-billede).

## Motivation

Christians SOTA-krav: "jeg vil have små videoer". Video løfter rækkevidden markant på alle tre platforme, men er dyrest og mest umodent — derfor spike først.

## Q3 — AFGJORT (2026-07-17): HYBRID

Spiken (F014.1) producerede et matchet 2×2 (samme on-brand still) og Christian valgte på evidens:

- **AI-klip** (Kling 2.5 Turbo Pro i2v via `ai.animate`, blessed fal-rute i ai-sdk 0.23.0, FAL_KEY-only): $0.35/5s-klip, ~62s gen, 1080p ægte generativ bevægelse. Wow, men per-klip-pris skalerer.
- **Skabelon-animation** (lokal ffmpeg-søm `lib/videoRender.ts`, Ken Burns + tekst-fade): $0, ~5s render, on-brand + styrbar, men "levende billede".

**Valg = HYBRID:** skabelon som DEFAULT (gratis, on-brand, tekst indbygget, skalerer), AI-klip SELEKTIVT på hero-opslag hvor bevægelsen bærer (lanceringer, mærkedage, kampagne-højdepunkter).

## Under-spørgsmål — AFGJORT (2026-07-17): FORESLÅ + GODKEND

Hvordan bliver et opslag "AI-video-værd"? Christians valg: **systemet foreslår, mennesket godkender** (ikke rent manuelt flag).

- **Foreslå-motoren** kigger på opslagets kæde til årshjulet: `posts.activityId → activities.type`. Er typen `lancering` eller `maerkedag` (de eksplicitte hero-øjeblikke), flagger motoren opslaget "AI-video-værd".
- Christian ser forslaget i opslags-detaljen, **godkender** → AI-klip genereres (16:9 + 9:16). **Afviser** → opslaget beholder gratis skabelon-video (eller intet).
- Ingen blind nat-generering: intet AI-klip (som koster penge) laves uden et menneskeligt ja. Skabelon-video ($0) kan altid laves på knap.

## Reuse (F217)

Tjekket mod `discovery.broberg.ai` FØR build:

- **AI-klip (image→video):** GENBRUG `ai.animate` fra `@broberg/ai-sdk` (0.23.0, blessed fal-rute). Ingen rå fal/Gemini-integration.
- **Skabelon-render (ffmpeg Ken Burns + tekst):** ingen fleet-pakke ejer ffmpeg-video (bekræftet: discovery + components intercom 17794 — `@broberg/media-transform` er sharp-billed-transform, ikke video). BYG lokalt bag den allerede-blessede, indkapslede søm `apps/web/src/server/lib/videoRender.ts`. Ekstraktion → delt `@broberg/video-render` er tracked (cardmem-idé 019f6ffb) og udløses ved consumer #2 (rule-of-three).
- **Voiceover/TTS/captions:** IKKE i scope for F014.2/F014.3 — auto-video på et enkelt opslag har ingen speak. Speak-tunge scripted promo hører til drejebogen (F016).

## Stories

- **F014.1 Spike** ✅ (Review): matchet 2×2 (AI-klip + skabelon, 16:9 + 9:16), pris/kvalitet dokumenteret, Christian valgte hybrid. Al video-gen via `ai.animate` — aldrig rå provider.

- **F014.2 Skabelon-video på opslag (gratis default)**: et opslag kan blive en gratis skabelon-video fra sit still. Datamodel (video pr. aspekt + status), render-rute (videoRender.ts → 16:9 + 9:16), still bevares som fallback, video-preview i platform-preview'et, video med i download-pakke + kopiér-flow. Deterministisk, $0, on-demand-knap.

- **F014.3 Foreslå + godkend (AI-opgradering på hero-opslag)**: foreslå-motoren flagger opslag på lancerings-/mærkedags-aktiviteter som "AI-video-værd"; forslag + godkend/afvis i opslags-detaljen; ved godkend genereres AI-klip (Kling via `ai.animate`) i 16:9 + 9:16 og erstatter skabelon-videoen; ved afvis beholdes skabelon. Bygger ovenpå F014.2's datamodel + preview + pakke.

## Datamodel (F014.2)

Et opslag med video har brug for begge formater + en tilstand. Minimal tilføjelse (posts har allerede `mediaType:"video"` + `mediaId`):

- `post_videos` (postId → posts, aspect `16:9|9:16`, mediaId → media_library (type video), technique `template|ai`, createdAt) — én række pr. format.
- `posts`: tilføj `videoStatus` (`none|suggested|approved|rendering|ready|failed`, default `none`) + `videoTechnique` (`template|ai`, nullable). Fallback = det eksisterende still (`mediaId`), som altid bevares.

## Foreslå-motoren (F014.3)

Ren, forklarlig regel (ingen LLM nødvendig): for hvert opslag med `activityId`, slå aktivitetens `type` op. `lancering|maerkedag` → `videoStatus='suggested'`. Alt andet → uændret. Kører ved opslag-oprettelse (aktivitets-genereringen, F013.2) og som et idempotent gennemløb man kan trigge. Forslaget er ikke-destruktivt: det sætter kun `suggested`, det genererer intet før godkendelse.

## Noter

- Undertekster: ai.transcribe når speak findes; indbrændte captions (SoMe ses uden lyd) — hører til F016-sporet.
- Render-eksekvering: skabelon (~5s) synkront på knap. AI (~62s) sætter `videoStatus='rendering'`, afventer `ai.animate`, sætter `ready` — UI viser loading + genhenter. Bun idleTimeout hævet (tidligere bug-fix) så lange kald ikke dør.
- Composite promo-video (Christians idé 019f71ab): ægte UI-optagelse (Lens) + logo + AI-B-roll. Blokeret på Lens record-flow (lens-gap 019f71ac). Egen F-feature, ikke F014.

## Afhængigheder

F012 (story-pipeline + medie-flow), F013 (årshjul/aktiviteter — leverer `activity.type`-signalet foreslå-motoren læser). F014.3 afhænger af F014.2 (datamodel + preview + pakke).

# Contentpush v5 — SOTA SoMe Content-apparat (KONCEPT, afventer Christians endelige nik)

> 2026-07-03: Christian så v1-skelettet (Plan v4's P1–P5) og sagde fra: *"jeg vil have et SOTA SoMe Content Push apparat — en kalender med de næste minimum 5 forberedte stories — image content — små videoer — et årshjul for alle mine online marketing aktiviteter"* og *"start HELT forfra idémæssigt"*.
> 2026-07-04: Christians konsoliderings-dokument med konkurrentanalyse (Hootsuite/Buffer/Meta) er flettet ind — kilde bevaret i `docs/PLAN-v5-input-konsolidering-og-konkurrentanalyse.md`.
> Mockup: cardmem Mockups `019f2a00…` (docs/mockups/v5-dashboard.html).

## Baggrund — hvorfor dette overhovedet findes (Christians ord)

Christian er træt af at holde forretningen i live på LinkedIn og sociale medier. Han ved han er nødt til det, men processen — finde på indhold, skrive, finde billede, huske at poste — er en pligt, ikke en lyst. **Contentpush automatiserer ikke hans tilstedeværelse væk; det fjerner friktionen** mellem "jeg har en god historie fra ugens arbejde" og "der ligger et færdigt, på-brand opslag klar". Det eneste han selv skal levere er en idé/overskrift — resten (tekst, hashtags, billede/video, timing, overblik) tager apparatet.

## Rejsen (så konteksten aldrig forsvinder igen)

| Version | Handlede om | Hvorfor den ændrede sig |
|---|---|---|
| v1 | Fuld automatisering via platform-API'er | For tungt: API-godkendelse, compliance-risiko |
| v2 | Manuel posting + notifikation + downloadbar pakke | Fjerner det risikable, bevarer værdien |
| v3 | Genbrug af @broberg/*-porteføljen, Stack B, cardmem-design | Byg ikke det der findes |
| v4 | Navn (Contentpush), design bekræftet, video→v2 | Løbende beslutninger |
| **v5** | **Gentænkt forfra som SOTA-apparat: årshjul → kalender → multi-modale stories** + konkurrent-lærdomme | Christian: v1-skelettet var ikke ambitionen |

Discord som kanal er et bevidst filosofi-valg: gratis, én webhook, nul SDK — mindst mulig kompleksitet for værdien (samme ånd som ship-dark og @broberg/cron).

## Idéen, forfra

Contentpush er ikke en post-kø. Det er **marketingafdelingen for hele porteføljen** — et apparat der *planlægger året, producerer indholdet færdigt og serverer det på rette dag*. Christian er redaktør, ikke producent.

**Tre lag, ét flow — strategien føder produktionen:**

```
ÅRSHJULET (strategi — 12 måneder, alle brands, AL online marketing)
  kampagner · sæsoner (Black Friday, jul, sommer) · lanceringer · faste serier
        │  aktiviteter har tema, periode, kanaler, kadence
        ▼
IDÉ-BIBLIOTEKET (råstof — Buffers "Create"-søjle, tilpasset solo)
  Christian smider overskrifter/anekdoter/"ugens historie" ind (app, Discord,
  telefon) · generatoren FORETRÆKKER hans idéer frem for at opfinde selv ·
  tom for idéer → AI foreslår ud fra årshjulets tema
        ▼
KALENDEREN (planlægning — måned/uge)
  hvert opslag på sin dato · GARANTI: altid ≥5 færdigproducerede stories
  per brand · pipelinen fylder selv op
        ▼
STORIES (produktion — færdige, multi-modale pakker)
  platform-tekster + hashtags · on-brand BILLEDE (Recraft/FLUX via ai-sdk)
  · kort VIDEO hvor det bærer · brandets voice (AutoDoc Discovery)
        ▼
REVIEW (platform-tro forhåndsvisning — Hootsuite/Buffer-lærdommen)
  opslaget vises SOM DET SER UD på LinkedIn / Instagram / Facebook —
  ikke rå tekst · godkend / regenerér tekst ELLER billede / omplanlæg
        ▼
LEVERING  →  notifikation på dagen · download-pakke ELLER kopiér-til-
  udklipsholder per platform · markér postet → pipelinen fylder op
```

## Hvad der gør det SOTA (og ikke bare en kø)

1. **Proaktivt.** Altid ≥5 færdige stories foran per brand; en tom plads udløser selv produktion om natten.
2. **Året er tænkt igennem.** Årshjulet gør sæsoner/kampagner til førsteklasses begreber — "Black Friday uge 47" bliver automatisk til tematiserede stories 2 uger før, i hvert brands voice.
3. **Christians historier først.** Idé-biblioteket gør hans hverdagsobservationer til råstoffet; AI'en er ghostwriter, ikke afsender.
4. **Alt indhold er færdigt.** Tekster per platform + on-brand billede (brand-styles, logoer i SVG) + korte videoer hvor formatet bærer.
5. **Man ser hvad man får.** Platform-tro preview før godkendelse — som Hootsuite/Buffer, men i cardmem-roen.
6. **Hele porteføljen, ét sted.** Brands som spor i samme kalender og årshjul; AutoDoc Discovery onboarder et nyt brand på minutter.

## Konkurrent-lærdomme (Christians research 2026-07-04)

- **Hootsuite:** skala/indsigt er deres spil (bureau-problem, ikke vores). Tager med: konceptet "færdiggodkendt on-brand indhold klar på sekunder" (deres Parliament) — det ER Contentpushs kerne, bare solo. Og platform-preview.
- **Buffer:** fire søjler Create/Publish/Analyze/Community. Tager med: **Create = idé-biblioteket** (nu i flowet ovenfor) og platform-preview. Analyze/Community er team-skala.
- **Meta Business Suite:** bekræfter værdien af ét samlet FB+IG-flow → understøtter v2's Lens-automation.
- **Bevidst FRAVALGT** (team-problemer Christian ikke har; evt. v2+): unified inbox/beskedhåndtering, konkurrent-benchmarking, betalt annoncestyring, sentiment-analyse.

## Motorrummet (bygget, genbruges 100%)

AI-tekst i brand-voice (Mistral) · billede/video-generering (ai-sdk F033: Recraft v4.1 raster+SVG via OpenRouter, Gemini Image, gpt-image-1; ai.video) · media-pipeline (R2 EU + HEIC→WebP-transform) · multi-brand-skema (brand_profiles fra dag ét) · cron-rytme + notify (@broberg/notify landet — v15-dokumentets stub-afsnit er overhalet) · review-actions + download-pakke. **Intet v1-arbejde er spildt — det var motoren; v5 er karrosseriet.**

### Overhalet i v15-inputtet (afgjort siden det blev skrevet)
- Notify-stub → **@broberg/notify@0.1.0 er live og i brug** (F004).
- Billed-provider/stil-konditionering (§5) → **afgjort**: `ai.trainStyle` (brand-LoRA, ~$2) + `ai.image` via ai-sdk; Recraft v4.1 til logoer/SVG (ai-sdk F033, kode-klar). GDPR-split dokumenteret (træning US = brand-only; Christians likeness = BFL EU + samtykke).
- Enkelt-tenant settings-model (§3) → **multi-brand**: brand_profiles (voice/platforme/interval/personaPolicy/LoRA) med broberg.ai, cardmem.com, trailmem.com seedet.
- Video "udskudt" (§6) → **trukket ind i v5** som bølge 3 (Christians SOTA-krav).

## Bølgeplan (re-planlægges som epics NÅR konceptet er godkendt)

| Bølge | Indhold | Bygger på |
|---|---|---|
| **1. Kalenderen + fyldt pipeline** | Kalender-view (mockup→build), ≥5-buffer per brand, billede på HVER story, **platform-tro preview i review**, **idé-bibliotek** (indbakke der føder generatoren), kopiér-til-udklipsholder | F012 (re-scopes), F003.3, ai-sdk F033 |
| **2. Årshjulet** | Aktivitets-model + årshjuls-view, aktivitet→story-generering | F015 (ny) |
| **3. Video + polish** | Korte videoer (ai.video, spike først), SOTA-finish | F014 (ny) |
| Sideløbende | Deploy (F011 — GO givet, holdt til konceptnik), F009 brand-scoping, F010 Discovery-consumer | eksisterende |

## Åbne spørgsmål til Christian
1. Reaktion på mockuppen — er DETTE retningen? (justeringer er billige nu)
2. Årshjulet: også ikke-SoMe-aktiviteter (nyhedsbreve, blogposts via cms) fra start, eller SoMe først?
3. Video: generative klip (AI) eller template-baserede animationer? (spike kan afgøre pris/kvalitet)
4. F011-deploy: kør nu (infra er koncept-uafhængig) eller vent på bølge 1?

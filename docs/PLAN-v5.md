# Contentpush v5 — SOTA SoMe Content-apparat (KONCEPT-UDKAST, afventer Christians reaktion)

> 2026-07-03: Christian så v1-skelettet (Plan v4's P1–P5) og sagde fra: *"jeg vil have et SOTA SoMe Content Push apparat — en kalender med de næste minimum 5 forberedte stories — image content — små videoer — et årshjul for alle mine online marketing aktiviteter"* og *"start HELT forfra idémæssigt"*. Dette dokument ER den nye idé. Mockup: cardmem Mockups `019f2a00…` (docs/mockups/v5-dashboard.html).

## Idéen, forfra

Contentpush er ikke en post-kø. Det er **marketingafdelingen for hele porteføljen** — et apparat der *planlægger året, producerer indholdet færdigt og serverer det på rette dag*. Christian er redaktør, ikke producent: han åbner ét dashboard, ser hvad apparatet har klar, retter til og godkender.

**Tre lag, ét flow — strategien føder produktionen:**

```
ÅRSHJULET (strategi — 12 måneder, alle brands, AL online marketing)
  kampagner · sæsoner (Black Friday, jul, sommer) · lanceringer · faste serier
        │  aktiviteter har tema, periode, kanaler, kadence
        ▼
KALENDEREN (planlægning — måned/uge)
  hvert konkret opslag ligger på sin dato · GARANTI: altid ≥5 færdig-
  producerede stories per brand · pipelinen fylder selv op
        ▼
STORIES (produktion — færdige, multi-modale pakker)
  platform-tekster + hashtags · on-brand BILLEDE (Recraft/FLUX via ai-sdk)
  · kort VIDEO hvor det bærer (ai.video) · genereret i brandets voice
  (AutoDoc Discovery) · review: godkend / regenerér / omplanlæg / download
```

## Hvad der gør det SOTA (og ikke bare en kø)

1. **Proaktivt, ikke reaktivt.** Apparatet er altid 5+ stories foran per brand. Tomme kolonner findes ikke — en tom plads i pipelinen udløser selv produktion (tekst + billede + evt. video) om natten.
2. **Året er tænkt igennem.** Årshjulet gør sæsoner og kampagner til førsteklasses begreber — "Black Friday uge 47" bliver automatisk til tematiserede stories i kalenderen 2 uger før, i hvert brands voice.
3. **Alt indhold er færdigt.** En story er aldrig "en tekst" — den er en komplet pakke klar til at poste: tekster per platform, on-brand billede (brand-LoRA/Recraft-styles, logoer i SVG), og korte videoer til reels/shorts hvor formatet bærer.
4. **Hele porteføljen, ét sted.** Brands som spor i samme kalender og samme årshjul — broberg.ai, cardmem.com, trailmem.com først; alle Christians projekter efterhånden. AutoDoc Discovery onboarder et nyt brand på minutter.
5. **Ser ud som det lover.** Cardmem-designsproget (ro, jordfarver, serif) — mockup-gaten før hver flade.

## Motorrummet (bygget, genbruges 100%)

AI-tekst i brand-voice (Mistral) · billede/video-generering (ai-sdk F033: Recraft v4.1, Gemini Image, gpt-image-1; ai.video) · media-pipeline (R2 EU + transform) · multi-brand-skema · cron-rytme + notify · review-actions + download-pakke. **Intet af v1-arbejdet er spildt — det var motoren; v5 er karrosseriet.**

## Bølgeplan (re-planlægges som epics NÅR konceptet er godkendt)

| Bølge | Indhold | Bygger på |
|---|---|---|
| **1. Kalenderen + fyldt pipeline** | Kalender-view (mockup→build), ≥5-buffer per brand, billede på HVER story | F012 (re-scopes), F003.3, ai-sdk F033 |
| **2. Årshjulet** | Aktivitets-model + årshjuls-view, aktivitet→story-generering | F015 (ny) |
| **3. Video + polish** | Korte videoer (ai.video, spike først), SOTA-finish, dark-mode | F014 (ny) |
| Sideløbende | Deploy (F011 — GO givet, holdt til konceptet er nikket af), F009 multi-brand-scoping, F010 Discovery-consumer | eksisterende |

## Åbne spørgsmål til Christian
1. Reaktion på mockuppen — er DETTE retningen? (justeringer er billige nu)
2. Årshjulet: skal det også rumme ikke-SoMe-aktiviteter (nyhedsbreve, blogposts via cms) fra start, eller SoMe først?
3. Video: generative klip (AI) eller template-baserede (tekst/billede-animationer)? Kvalitet/pris-spike afgør — men din præference styrer.
4. F011-deploy: kør nu (infra er koncept-uafhængig) eller vent på bølge 1?

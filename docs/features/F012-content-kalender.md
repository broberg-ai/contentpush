# F012 — Content-kalender + 5-story pipeline-buffer

> Christians SOTA-vision 2026-07-03: "jeg vil have et SOTA SoMe Content Push apparat - en kalender med de næste minimum 5 forberedte stories". Opgraderer Plan v4's kø-tænkning (ét opslag ad gangen hver 14. dag) til en fremadskuende pipeline. Depends on F005 (køen/detail-view genbruges) + F009 (per-brand).

## Motivation
En kø med ét næste opslag er reaktiv. Et rigtigt content-apparat er PROAKTIVT: du åbner kalenderen og ser de næste 5+ færdige stories ligge klar på deres datoer — pr. brand — og pipelinen fylder selv op når du poster eller kasserer noget.

## Scope
1. **Pipeline-buffer:** tick'en holder ALTID ≥ minBuffer (default 5, felt på brand_profiles) forberedte stories (draft/ready) per brand, med scheduledDates fordelt frem i tiden efter brandets interval. Poster/kasserer du én, genereres en ny.
2. **Kalender-view:** måneds- og ugevisning; hvert opslag ligger på sin scheduledDate med brand-farve, thumbnail (når F013 lander) og status; klik åbner detail-modalen (F005.2 genbruges).
3. **Omplanlægning:** flyt et opslag til en anden dato (custom date-picker / drag i ugevisning).

## Design
Mockup FØRST (cardmem_save_mockup, bygget på @broberg/theme-tokens) — kalenderen ER produktets ansigt; den skal godkendes af Christian før build.

## Non-goals
- Årshjulet (12-mdr aktivitets-planlægning) er F015 — kalenderen her er opslags-niveauet.
- Auto-posting er stadig v2 (F007).

## Stories
- **F012.1** — Pipeline-buffer: tick holder ≥5 forberedte stories per brand.
- **F012.2** — Kalender-view (mockup → godkendelse → build, måned + uge).
- **F012.3** — Omplanlægning (custom date-picker + drag).

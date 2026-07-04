# F013 — Bølge 2: Årshjulet + timing

> Oprettet 2026-07-04 ved v5-re-planlægningen (mockups godkendt). Kilde: `docs/PLAN-v5.md` punkt 2, 7 + mockups `019f2a00…` (årshjul-bånd), `019f2a27…` (event foldet ud), `019f2a44-1b27…` (timing).

## Motivation

Årshjulet gør sæsoner/kampagner/lanceringer til førsteklasses begreber: et event er en PRODUKTIONS-ORDRE (tema + periode + brands + kadence + tone-instruks) som apparatet selv omsætter til stories 2 uger før (produktions-vinduet). Timing-laget sikrer at intet postes på dumme dage (helligdage, valgdage) og at alt postes i platformens gode tidsrum.

## Stories

- **F013.1 Aktivitets-model + årshjuls-view**: activities-tabel (title, type kampagne|serie|lancering|mærkedag, periodStart/End, brandIds, channels, cadence, toneInstruks, generatePolicy), årshjuls-bånd i dashboard (12 mdr, lanes, klik→event-detalje jf. mockup).
- **F013.2 Aktivitet→story-generering**: produktions-vindue (default 14 dage før periodStart) — nat-ticket genererer aktivitetens stories m. tema + tone-instruks (instruksen VINDER over AI-vinkler); dæknings-liste på event-detaljen; faste serier pauses automatisk i kampagne-uger (kollisions-regel fra detalje-mockuppen).
- **F013.3 Mærkedage + tidsvinduer**: dansk helligdagskalender indbygget (AUTO) + egne mærkedage (undgå|udnyt, global eller per brand); tidsvinduer per platform×brand (default-sæt fra mockuppen); tick planlægger aldrig ind i undgå-dage og FLYTTER kollisioner m. synlig begrundelse ("↷ flyttet fra…"); notify-tidspunkt følger vinduets start; udnyt-dage trækker tematiseret ekstra-story.

## Arkitektur-noter

- Helligdags-beregning: dansk kalender kan beregnes lokalt (påske-formel) — ingen ekstern API-afhængighed.
- `posts.movedFrom?` + `movedReason?` til flytte-sporbarhed.
- Tidsvinduer: `posting_windows` (brandId?, platform, weekdayMask, startMin, endMin, isBest) — null brandId = global default.

## Afhængigheder

Bygger OVENPÅ F012 (kalenderen er rammen; buffer-logikken udvides med vindue/mærkedags-regler). Start først når F012 er i Review.

## Non-goals

Video (F014), nyhedsbrev (F015 — men events af type nyhedsbrev SKAL kunne oprettes, de producerer bare først når F015 findes).

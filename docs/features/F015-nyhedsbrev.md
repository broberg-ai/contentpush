# F015 — Bølge 4: Nyhedsbrev + mailingliste

> Oprettet 2026-07-04 ved v5-re-planlægningen. Kilde: `docs/PLAN-v5.md` punkt 8 + godkendt mockup `019f2a44-3571…`.

## Motivation

Christians input 2026-07-04: Contentpush skal kunne producere og populere et nyhedsbrev for sine brands — og evt. helt eje mailinglisten for sites der ikke selv vil have teknologien. Nyhedsbrevet er GENBRUG: periodens godkendte stories bliver blokke, intro skrives i brandets voice, emnelinjer foreslås. Udsendelse følger timing-reglerne (F013.3-vinduet, fx sidste torsdag 10:00).

## Åbne spørgsmål (skal besvares før F015.2 bygges)

- **Q5**: Skal Contentpush EJE liste + signup fra start, eller først producere indhold til eksisterende lister (indholdet leveres via API) og tage liste-ejerskabet i næste hug?
- **Q6**: Kadence per brand — månedligt som udgangspunkt?

## Stories

- **F015.1 Composer + preview + udsendelse**: newsletters-tabel, auto-population (periodens godkendte stories → blokke, byt-stories-mulighed), AI-intro i voice + 2 emnelinje-forslag, email-tro preview jf. mockup, test-mail til Christian, planlagt udsendelse via @broberg/mail (ALDRIG rå Resend/SMTP — reuse-first), GDPR-footer m. afmeld-link.
- **F015.2 Mailingliste** (afventer Q5): subscribers-tabel (EU-lagring i egen Turso), double opt-in-flow, ét-kliks afmeld, embed signup-widget (`signup.js` + data-brand) til sites uden egen teknologi, API-levering af færdig mail til sites med egen.

## Arkitektur-noter

- Mail-rendering: inline-CSS HTML (email-klienter), samme design-tokens oversat til email-safe styling.
- Afmeld: signed one-click-link → status unsubscribed; ingen manuel liste-hygiejne.
- Persondata (emails) = GDPR: EU-lagring, aldrig gennem US-modeller (AI ser kun indhold, aldrig modtagerlisten).

## Afhængigheder

F012 (stories som kilde). Timing-vinduet fra F013.3 er nice-to-have, ikke blocker (fast udsendelses-tidspunkt duer indtil da).

# Contentpush — Plan v5

## Baggrund — hvorfor dette overhovedet findes

Du er træt af at holde din forretning i live på LinkedIn og sociale medier. Du ved du er nødt til det for at få og fastholde business, men selve processen — at finde på indhold, skrive teksten, finde et billede, huske at poste — er noget du direkte ikke gider. Det er ikke lyst, det er en pligt.

Contentpush er ikke et forsøg på at automatisere din tilstedeværelse væk fra dig. Det er et forsøg på at fjerne *friktionen* mellem "jeg har en god historie fra ugens arbejde" og "der ligger et færdigt, på-brand opslag klar til at blive postet" — så det eneste du selv skal levere er en overskrift og en kort intro til hvad du/firmaet laver. Resten af tyngden (tekst, hashtags, billede, huske det, holde styr på det) tager systemet.

## Rejsen frem til v5 (så vi ikke mister kontekst igen)

| Version | Hvad den handlede om | Hvorfor den ændrede sig |
|---|---|---|
| v1 | Fuld automatisering: API-adgang til LinkedIn/IG/FB, autoposting | For tungt — API-godkendelse, compliance-risiko, platformsbegrænsninger |
| v2 | Du dropper selv API-delen: kalenderpåmindelse + Discord-notifikation, du poster manuelt, systemet leverer en downloadbar pakke (tekst + hashtags + billede/video, kopiér-til-udklipsholder eller zip) | Fjerner det tungeste og mest risikable — bevarer værdien (indholdsgenerering) |
| v3 | Støvet af mod hele `@broberg/*`-porteføljen via Discovery, lagt på Stack B, cardmem-designparadigme | Skal genbruge det I allerede har bygget, ikke opfinde det igen |
| v4 | Navn låst (**Contentpush**), design bekræftet, video udskudt til v2-scope, notify-pakke og billedstil-beslutning flyttet til rette sted | Beslutninger taget løbende i dialogen |
| v5 (denne) | Samler hele resonnementet ét sted, så planen kan stå alene | Du påpegede at konteksten var ved at forsvinde undervejs |

**Discord specifikt** (så det ikke fremstår som en tilfældig teknisk detalje): du valgte Discord frem for fx e-mail eller SMS, fordi det er gratis og har en simpel webhook-grænseflade — ingen SDK, ingen godkendelsesproces, bare et POST-kald. Det er præcis samme filosofi som resten af jeres stack (`@broberg/mail`'s ship-dark-mønster, `@broberg/cron`'s lette klient): mindst mulig kompleksitet for den værdi det giver.

---

## 1. Konceptet, som det står i dag

Hver 14. dag:

1. **Systemet genererer et udkast** — post-tekst + hashtags, tilpasset LinkedIn/Instagram/Facebook hver især (professionel tone på LinkedIn, mere visuel/afslappet på IG/FB), ud fra en headline og din faste virksomheds-kontekst (hvem du er, hvad WebHouse laver, hvad I er specialiseret i)
2. **Systemet finder eller genererer et billede** — enten fra dit kuraterede stock-bibliotek, eller AI-genereret i din visuelle stil (se §5 om stil-konditionering)
3. **Discord-notifikation**: "🎨 Nyt udkast klar til gennemsyn"
4. **Du åbner dashboardet** — ser udkastet som et kort (cardmem-paradigme: roligt, varmt, jordfarver, serif-overskrifter), kan regenerere tekst eller billede hvis det ikke rammer, og godkender
5. **Discord-notifikation** på selve dagen: "✅ Tid til at poste i dag"
6. **Du downloader pakken** — zip med `linkedin.txt`, `instagram.txt`, `facebook.txt` + billede/video — eller kopierer tekst direkte til udklipsholder
7. **Du poster manuelt** på hver platform, i dit eget tempo
8. **Du markerer som postet** → næste post planlægges automatisk +14 dage

Ingen platform-API i v1. Du er stadig den der trykker "post" — systemet fjerner kun tomme-siden-angsten og det administrative bøvl.

---

## 2. Stack & designparadigme

**Stack B**: Bun + Hono + Preact + Vite. Ingen shadcn/Tailwind — ren `@broberg/theme`-styling, samme visuelle sprog som Cardmem (jordfarver, serif-overskrifter, roligt udtryk). Bekræftet 2026-07-03.

**Genbrugte `@broberg/*`-pakker** (bekræftet shipped via discovery.broberg.ai):

| Behov | Pakke | Rolle i Contentpush |
|---|---|---|
| Design tokens | `@broberg/theme` | Al styling |
| AI-tekst | `@broberg/ai-sdk` (Mistral) | Post-tekst + hashtags |
| Medielagring | `@broberg/media` | Stock-bibliotek + genererede billeder + video-filer |
| Billedtransform | `@broberg/media-transform` | HEIC→WebP, responsive størrelser før pakken zippes |
| Scheduling | `@broberg/cron` | 14-dages trigger |
| Database | `@broberg/db-sdk` (Turso) | Enkelt-tenant — kun dig som bruger |
| Omkostningslog | `@upmetrics/sdk` | AI-genereringsomkostninger, samme mønster som F113 |
| Notifikation | `@broberg/notify` (Discord + Slack) 🔜 under udvikling | Erstatter midlertidig webhook-stub når den lander |

**Stack B scaffold** (`@broberg/stack-b-base`) er endnu ikke shippet — bootstrappes manuelt efter samme konventioner, migreres når pakken er klar.

**Cardmem-registrering**: du opretter selv repo + Cardmem-projekt manuelt — ikke noget jeg gør.

---

## 3. Database (Turso, enkelt-tenant)

```typescript
posts {
  id, headline, companyContext,
  linkedinText, instagramText, facebookText,
  hashtags,                    // json, per platform
  mediaType,                   // 'stock' | 'ai-generated' | 'video'
  mediaId,                     // fk → media_library
  status,                      // 'draft' | 'ready' | 'posted'
  scheduledDate, postedAt, createdAt
}

media_library {
  id, url, type, tags, description, createdAt
}

settings {
  companyIntro, brandVoice,
  discordWebhookUrl,           // .env, ikke DB
  postingIntervalDays          // default 14
}
```

---

## 4. Notifikation — midlertidig stub

`@broberg/notify` (Discord + Slack samlet) er på vej. Indtil den lander, en bevidst løs, udskiftelig stub:

```typescript
// apps/web/src/server/routes/discord.ts — MIDLERTIDIG, erstat med @broberg/notify
import 'dotenv/config';

async function notifyDiscord(message: string) {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) {
    console.warn('DISCORD_WEBHOOK_URL not set — skipping notify (ship-dark)');
    return { ok: false, skipped: true };
  }
  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: message }),
  });
  return { ok: res.ok, status: res.status };
}
```

Ship-dark-mønster lånt fra `@broberg/mail`: crasher aldrig et flow hvis nøgle/URL mangler.

---

## 5. Billeder — stil-konditionering

Beslutning: brug ~$2 og et par minutter på at "vise" AI'en et udsnit af dine egne billeder én gang, så genereret billedmateriale rammer din faktiske visuelle stil og dit brand — frem for generiske AI-stockbilleder. Din vurdering: forskellen på "ligner mit brand" og "ligner en tilfældig stockphoto" er den investering værd.

**Hvilken provider/model** der konkret understøtter stil-konditionering inden for `@broberg/ai-sdk`s model-boundary (DeepInfra) — eller om det kræver noget uden for boundary — genbesøges når planen konstrueres i Cardmem, ikke her.

---

## 6. Video — bevidst udskudt

v1 = tekst + billeder only. Video gør det hele tungere, og der findes ingen video-transform-pakke i porteføljen i dag. Tilføjes i v2, når resten kører stabilt.

---

## 7. Roadmap ud over v1

- **v1** (denne plan): manuel posting, nul API-risiko
- **v2**: automatiseret posting afprøvet via `@broberg/lens` (Playwright + pixelmatch, samme mønster som Storeform bruger til App Store-formularer) — spike, ikke big-bang. v1-dashboardet forbliver brugbart som manuel fallback uanset udfald
- **v3**: officiel platform-API (LinkedIn Share API, Meta Graph API) kun hvis Lens-automation viser sig for skrøbel over for UI-ændringer/bot-detektion — fallback, ikke førstevalg
- **v2+**: instruktionsvideoer

---

## 8. Status på beslutninger

| Beslutning | Status |
|---|---|
| Navn | ✅ Contentpush |
| Design | ✅ Cardmem-paradigme, ren `@broberg/theme` |
| Video-scope v1 | ✅ Udskudt til v2 |
| Discord vs. andre kanaler | ✅ Discord — gratis, simpel webhook |
| Notify-pakke | ✅ Vent på `@broberg/notify`, brug stub indtil da |
| Billed-provider | 🔜 Afklares i Cardmem-konstruktionsfasen |
| Cardmem-oprettelse | ✅ Du gør det manuelt |

---

## 9. Konkurrentanalyse — hvad markedet gør, og hvad vi tager med

Research udført 2026-07-04 på de tre mest nævnte platforme i din research-forespørgsel: Hootsuite, Buffer, Meta Business Suite. Formålet er ikke at kopiere deres omfang — de bygger til bureauer der styrer *mange* kunders konti, du bygger til at fjerne friktion for *dig selv* — men at stjæle de UX-idéer der giver mening i lille skala.

### Hootsuite — markedslederens positionering
Hootsuites selvfremstilling centrerer om skala og indsigt: ét forbundet dashboard der viser hvad der sker, hvad man skal gøre næst, og handler derpå — med personlige forslag til hvordan man vinder i sin branche, og over 100 integrationer (flest i markedet, ifølge dem selv). Deres "Parliament"-feature er værd at bemærke konceptuelt: færdiggodkendt, on-brand indhold medarbejdere kan dele på sekunder — samme grundtanke som Contentpush, bare til teams i stedet for solo.

### Buffer — det gennemsigtige, simple alternativ
Buffer positionerer sig som "dit sociale medie-workspace" bygget på fire søjler: Create (idé-bibliotek), Publish (skemalægning), Analyze (indsigt) og Community (svar hurtigt på tværs af kanaler). Det mest overførbare til Contentpush er ikke en funktion, men en kulturel beslutning: siden 2013 har Buffer delt deres økonomi og nøgletal helt åbent — en gennemsigtighed der matcher jeres egen WebHouse-stil.

### Meta Business Suite — det kedelige, gratis utility-værktøj
Ingen marketing-narrativ at hente her — det er et rent nytteværktøj fra Meta til at administrere tilstedeværelse på tværs af deres platforme, uden noget produkt at sælge dig. Mest relevant for jeres v2/v3-roadmap: det bekræfter at Meta selv anerkender værdien af ét samlet flow for Facebook + Instagram, hvilket understøtter jeres Lens-baserede automation-tanke i v2.

### Konkret feature der tages med i Contentpush
**Platform-tro forhåndsvisning før publicering.** Både Hootsuite og Buffer viser hvordan opslaget rent faktisk kommer til at se ud på hver enkelt platform, ikke bare rå tekst i et tekstfelt. Tilføjet til `PostCard`-komponentet i P5 (dashboard UI) — et letvægts preview-lag oven på eksisterende `linkedinText`/`instagramText`/`facebookText`-felter, ingen ny infrastruktur nødvendig.

**Bevidst fravalgt** (for meget scope til v1, men noteret til evt. v2+): unified inbox/beskedhåndtering, konkurrent-benchmarking, betalt annoncestyring, sentiment-analyse. Ingen af disse løser din oprindelige friktion — de løser et team-skala-problem du ikke har.

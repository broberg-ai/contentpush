import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

// Multi-brand fra dag ét (F009): brand-felterne der i Plan v4 §4 lå i en
// global settings-tabel er per-brand her. settings er kun app-globale værdier.

export const brandProfiles = sqliteTable("brand_profiles", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  siteUrl: text("site_url"),
  companyContext: text("company_context"),
  brandVoice: text("brand_voice"),
  platforms: text("platforms", { mode: "json" }).$type<string[]>(),
  postingIntervalDays: integer("posting_interval_days").notNull().default(14),
  // 'brand-only' → trainStyle-LoRA (aldrig ansigter); 'portrait-allowed' → BFL EU portrait path
  personaPolicy: text("persona_policy", {
    enum: ["brand-only", "portrait-allowed"],
  })
    .notNull()
    .default("brand-only"),
  loraId: text("lora_id"),
  // F010.1: AutoDoc-kladder. 'draft' = foreslået profil fra discovery —
  // aktiveres ALDRIG automatisk (Christians godkendelse i F010.2 flipper den).
  // Generering/tick arbejder KUN på 'active'.
  // F009.1: 'archived' = blødt slettet (aldrig FK-hård-slet; usynlig i UI/generering)
  status: text("status", { enum: ["active", "draft", "archived"] })
    .notNull()
    .default("active"),
  // Hvilket aktivt brand kladden foreslår en opdatering af (null = nyt target)
  sourceBrandId: text("source_brand_id"),
  autodocSlug: text("autodoc_slug"),
  // Rå brand_signals fra AutoDoc gemmes VERBATIM (projiceres i generator-prompt)
  brandSignals: text("brand_signals", { mode: "json" }),
  // F010.2: grounding (produktnavn/README-summary/site) = berigelses-kilden vist i review
  grounding: text("grounding", { mode: "json" }),
  analyzedAt: integer("analyzed_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const mediaLibrary = sqliteTable("media_library", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  url: text("url").notNull(),
  type: text("type", {
    enum: ["stock-image", "ai-image", "video"],
  }).notNull(),
  tags: text("tags", { mode: "json" }).$type<string[]>(),
  description: text("description"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// F012.3: Idé-biblioteket — Christians rå idéer er generatorens råstof.
// rawText gemmes VERBATIM og omskrives ALDRIG (mockup-kontrakt: "din idé,
// som du skrev den"). Generatoren foretrækker ældste ubrugte idé for brandet.
export const ideas = sqliteTable("ideas", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  brandId: text("brand_id").references(() => brandProfiles.id),
  rawText: text("raw_text").notNull(),
  status: text("status", {
    enum: ["captured", "enriched", "planned", "used", "archived"],
  })
    .notNull()
    .default("captured"),
  suggestedDate: integer("suggested_date", { mode: "timestamp" }),
  usedByPostId: text("used_by_post_id"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const posts = sqliteTable("posts", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  brandId: text("brand_id")
    .notNull()
    .references(() => brandProfiles.id),
  headline: text("headline").notNull(),
  linkedinText: text("linkedin_text"),
  instagramText: text("instagram_text"),
  facebookText: text("facebook_text"),
  hashtags: text("hashtags", { mode: "json" }).$type<
    Record<string, string[]>
  >(),
  mediaType: text("media_type", {
    enum: ["stock", "ai-generated", "video"],
  }),
  mediaId: text("media_id").references(() => mediaLibrary.id),
  // F012.3: sporbarhed — hvilken idé storyen er bygget på (null = auto-headline)
  ideaId: text("idea_id"),
  // F013.2: hvilken årshjul-aktivitet storyen kom fra (null = fast serie/buffer)
  activityId: text("activity_id"),
  // F013.3: flytte-sporbarhed når en story blev flyttet væk fra en undgå-dag
  movedFrom: integer("moved_from", { mode: "timestamp" }),
  movedReason: text("moved_reason"),
  // F012.4: billed-generering fejlede/mangler — storyen lever, billedet kan regenereres
  imagePending: integer("image_pending", { mode: "boolean" }).notNull().default(false),
  status: text("status", { enum: ["draft", "ready", "posted"] })
    .notNull()
    .default("draft"),
  scheduledDate: integer("scheduled_date", { mode: "timestamp" }),
  postedAt: integer("posted_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// F013.1: Årshjulet — en aktivitet er en PRODUKTIONS-ORDRE (tema + periode +
// brands + kanaler + kadence + tone-instruks). F013.2 omsætter den til stories
// i produktions-vinduet; tone-instruksen VINDER over AI'ens egne vinkler.
export const activities = sqliteTable("activities", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  title: text("title").notNull(),
  // lanes i årshjulet: kampagne + serie + lancering/maerkedag
  type: text("type", {
    enum: ["kampagne", "serie", "lancering", "maerkedag"],
  }).notNull(),
  periodStart: integer("period_start", { mode: "timestamp" }).notNull(),
  periodEnd: integer("period_end", { mode: "timestamp" }).notNull(),
  // brandIds tom/null = alle brands; ellers de valgte
  brandIds: text("brand_ids", { mode: "json" }).$type<string[]>(),
  channels: text("channels", { mode: "json" }).$type<string[]>(),
  // stories pr. brand i perioden (F013.2 bruger den til dækning)
  cadencePerBrand: integer("cadence_per_brand").notNull().default(1),
  toneInstruks: text("tone_instruks"),
  // auto = pipelinen genererer i produktions-vinduet; manual = kun på knap
  generatePolicy: text("generate_policy", { enum: ["auto", "manual"] })
    .notNull()
    .default("auto"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// F013.3: egne mærkedage (undgå|udnyt). Den danske helligdagskalender beregnes
// indbygget (lib/holidays.ts) og lagres IKKE — kun Christians egne dage her.
// month/day = årligt tilbagevendende (fx 27/11 Black Friday). brandId null = global.
export const markerDays = sqliteTable("marker_days", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  title: text("title").notNull(),
  kind: text("kind", { enum: ["avoid", "use"] }).notNull(),
  month: integer("month").notNull(), // 1-12
  day: integer("day").notNull(), // 1-31
  brandId: text("brand_id"), // null = global
  note: text("note"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// F013.3: tidsvinduer per platform (× brand). brandId null = global default.
// weekdays = åbne ugedage (0=søn…6=lør). bestWeekday = ★ bedste slot.
export const postingWindows = sqliteTable("posting_windows", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  brandId: text("brand_id"), // null = global default
  platform: text("platform").notNull(), // linkedin | instagram | facebook | newsletter
  weekdays: text("weekdays", { mode: "json" }).$type<number[]>().notNull(),
  bestWeekday: integer("best_weekday"), // 0-6 el. null
  startMin: integer("start_min").notNull(), // minutter fra midnat
  endMin: integer("end_min").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value"),
});

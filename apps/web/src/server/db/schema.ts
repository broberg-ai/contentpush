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
  status: text("status", { enum: ["active", "draft"] })
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

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value"),
});

import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core'

// ─── User ────────────────────────────────────────────────────────────
export const users = sqliteTable('users', {
  id: text('id').primaryKey(), // nanoid
  email: text('email').notNull().unique(),
  settings: text('settings', { mode: 'json' }).$type<{
    timezone?: string
    preferences?: Record<string, unknown>
  }>(),
  createdAt: text('created_at').notNull(), // ISO 8601 UTC
})

// ─── AuthToken (magic link auth) ────────────────────────────────────
//
// Flow:
//   POST /api/auth/send → create token → email via Resend
//   GET /api/auth/verify?token= → validate → set JWT cookie
//
// Security: single-use (usedAt), 15-min TTL, crypto-random 128-bit
// ─────────────────────────────────────────────────────────────────────
export const authTokens = sqliteTable('auth_tokens', {
  id: text('id').primaryKey(), // nanoid
  email: text('email').notNull(),
  token: text('token').notNull().unique(), // crypto-random
  expiresAt: text('expires_at').notNull(), // ISO 8601 UTC
  usedAt: text('used_at'), // null until consumed — enforces single-use
  createdAt: text('created_at').notNull(),
})

// ─── Entry (Single Table Inheritance — all 6 diary entry types) ─────
//
// ┌──────────────────────────────────────────────────────────┐
// │ type        │ Required fields       │ Nullable fields    │
// ├─────────────┼───────────────────────┼────────────────────┤
// │ meal        │ mealType, foods       │ portionSize        │
// │ symptom     │ symptomType, severity │ location, duration │
// │ bowel       │ bristolType           │ urgency,blood,mucus│
// │ emotion     │ mood                  │ stress,sleep,anxiety│
// │ impact      │ impactSeverity        │ affected,description│
// │ note        │ notes                 │ —                  │
// └──────────────────────────────────────────────────────────┘
//
// Zod validates type-specific required fields at the API layer.
// ─────────────────────────────────────────────────────────────────────
export const entries = sqliteTable('entries', {
  id: text('id').primaryKey(), // nanoid
  userId: text('user_id').notNull().references(() => users.id),
  timestamp: text('timestamp').notNull(), // ISO 8601 UTC
  type: text('type').notNull(), // meal|symptom|bowel|emotion|impact|note

  // Shared
  notes: text('notes'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),

  // ── Meal fields (type = 'meal') ──
  mealType: text('meal_type'), // breakfast|lunch|dinner|supper|snack
  foods: text('foods', { mode: 'json' }).$type<
    Array<{ name: string; portion?: string }>
  >(),
  portionSize: text('portion_size'), // small|normal|large|huge

  // ── Symptom fields (type = 'symptom') ──
  symptomType: text('symptom_type'), // bloating|pain|nausea|gas|cramps|fatigue|other
  severity: integer('severity'), // 1-5
  location: text('location'), // upper_left|upper_right|lower_left|lower_right|central|all
  duration: integer('duration'), // minutes

  // ── Bowel fields (type = 'bowel') ──
  bristolType: integer('bristol_type'), // 1-7
  urgency: text('urgency'), // none|mild|moderate|severe
  blood: integer('blood', { mode: 'boolean' }),
  mucus: integer('mucus', { mode: 'boolean' }),

  // ── Emotion fields (type = 'emotion') ──
  mood: integer('mood'), // 1-5
  stressLevel: integer('stress_level'), // 1-5
  sleepQuality: integer('sleep_quality'), // 1-5
  anxietyLevel: integer('anxiety_level'), // 1-5

  // ── Impact fields (type = 'impact') ──
  impactSeverity: text('impact_severity'), // none|mild|moderate|severe
  affectedActivities: text('affected_activities', { mode: 'json' }).$type<string[]>(),
  description: text('description'),
})

// ─── Correlation (statistical insights — computed on-demand) ────────
export const correlations = sqliteTable('correlations', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  triggerType: text('trigger_type').notNull(), // food|emotion|time_of_day|combination
  triggerValue: text('trigger_value').notNull(),
  symptomType: text('symptom_type').notNull(),
  confidence: real('confidence').notNull(), // 0-1
  relativeRisk: real('relative_risk').notNull(),
  consistencyRatio: real('consistency_ratio').notNull(),
  occurrences: integer('occurrences').notNull(),
  totalOpportunities: integer('total_opportunities').notNull(),
  windowHours: integer('window_hours').notNull().default(6),
  createdAt: text('created_at').notNull(),
  lastUpdatedAt: text('last_updated_at').notNull(),
})

// ─── Experiment ─────────────────────────────────────────────────────
export const experiments = sqliteTable('experiments', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  name: text('name').notNull(),
  description: text('description'),
  status: text('status').notNull().default('active'), // active|completed|abandoned
  eliminatedFoods: text('eliminated_foods', { mode: 'json' })
    .$type<string[]>()
    .notNull(),
  startDate: text('start_date').notNull(),
  endDate: text('end_date'),
  durationDays: integer('duration_days').notNull(),
  baselineSymptomRate: real('baseline_symptom_rate'),
  currentSymptomRate: real('current_symptom_rate'),
  result: text('result'), // significant_improvement|mild_improvement|no_change|worsened|null
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

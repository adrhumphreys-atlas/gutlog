import { z } from 'zod'

// ─── Shared ──────────────────────────────────────────────────────────

const isoTimestamp = z
  .string()
  .datetime()
  .refine(
    (val) => {
      const ts = new Date(val).getTime()
      const now = Date.now()
      const fiveMinGrace = 5 * 60 * 1000
      return ts <= now + fiveMinGrace
    },
    { message: 'Timestamp cannot be in the future (5 min grace)' }
  )

// ─── Entry Type Schemas (Zod Discriminated Union) ────────────────────

const mealEntry = z.object({
  type: z.literal('meal'),
  timestamp: isoTimestamp,
  mealType: z.enum(['breakfast', 'lunch', 'dinner', 'supper', 'snack']),
  foods: z
    .array(
      z.object({
        name: z.string().max(200),
        portion: z.string().max(100).optional(),
      })
    )
    .min(1)
    .max(20),
  portionSize: z.enum(['small', 'normal', 'large', 'huge']).optional(),
  notes: z.string().max(1000).optional(),
})

const symptomEntry = z.object({
  type: z.literal('symptom'),
  timestamp: isoTimestamp,
  symptomType: z.enum([
    'bloating',
    'pain',
    'nausea',
    'gas',
    'cramps',
    'fatigue',
    'other',
  ]),
  severity: z.number().int().min(1).max(5),
  location: z
    .enum([
      'upper_left',
      'upper_right',
      'lower_left',
      'lower_right',
      'central',
      'all',
    ])
    .optional(),
  duration: z.number().int().min(1).optional(),
  notes: z.string().max(1000).optional(),
})

const bowelEntry = z.object({
  type: z.literal('bowel'),
  timestamp: isoTimestamp,
  bristolType: z.number().int().min(1).max(7),
  urgency: z.enum(['none', 'mild', 'moderate', 'severe']).optional(),
  blood: z.boolean().optional(),
  mucus: z.boolean().optional(),
  notes: z.string().max(1000).optional(),
})

const emotionEntry = z.object({
  type: z.literal('emotion'),
  timestamp: isoTimestamp,
  mood: z.number().int().min(1).max(5),
  stressLevel: z.number().int().min(1).max(5).optional(),
  sleepQuality: z.number().int().min(1).max(5).optional(),
  anxietyLevel: z.number().int().min(1).max(5).optional(),
  notes: z.string().max(1000).optional(),
})

const impactEntry = z.object({
  type: z.literal('impact'),
  timestamp: isoTimestamp,
  impactSeverity: z.enum(['none', 'mild', 'moderate', 'severe']),
  affectedActivities: z.array(z.string().max(200)).optional(),
  description: z.string().max(1000).optional(),
  notes: z.string().max(1000).optional(),
})

const noteEntry = z.object({
  type: z.literal('note'),
  timestamp: isoTimestamp,
  notes: z.string().min(1).max(1000),
})

export const entrySchema = z.discriminatedUnion('type', [
  mealEntry,
  symptomEntry,
  bowelEntry,
  emotionEntry,
  impactEntry,
  noteEntry,
])

export type EntryInput = z.infer<typeof entrySchema>
export type EntryType = EntryInput['type']

// ─── Experiment Schema ───────────────────────────────────────────────

export const createExperimentSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  eliminatedFoods: z.array(z.string().max(200)).min(1),
  durationDays: z.number().int().min(1).max(90),
})

export const updateExperimentSchema = z.object({
  status: z.enum(['active', 'completed', 'abandoned']).optional(),
  currentSymptomRate: z.number().min(0).optional(),
  result: z
    .enum([
      'significant_improvement',
      'mild_improvement',
      'no_change',
      'worsened',
    ])
    .optional(),
})

// ─── Auth Schema ─────────────────────────────────────────────────────

export const sendMagicLinkSchema = z.object({
  email: z.string().email(),
})

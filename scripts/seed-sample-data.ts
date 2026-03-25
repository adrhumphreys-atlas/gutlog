/**
 * GutLog — 30-Day Sample Data Seed Script (JSON Import Format)
 *
 * Generates realistic gut health diary entries matching the POST /api/export import format.
 * Each entry matches the Zod entrySchema (type, timestamp, + type-specific fields).
 *
 * Designed to produce meaningful insights from the correlation engine:
 *   - Primary trigger foods appear ≥5 times across 30 days
 *   - Symptoms reliably follow trigger foods within the 6-hour window
 *   - Safe foods appear frequently WITHOUT symptoms, creating a strong baseline
 *   - This gives high relative risk and confidence scores for trigger foods
 *
 * Usage:
 *   npx tsx scripts/seed-sample-data.ts > scripts/seed.json
 *
 * Then import via the app UI or:
 *   curl -X POST http://localhost:8787/api/export \
 *     -H "Content-Type: application/json" \
 *     -H "Cookie: token=<your-jwt>" \
 *     -d @scripts/seed.json
 */

// ─── Helpers ──────────────────────────────────────────────────────────

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function pickN<T>(arr: T[], min: number, max: number): T[] {
  const n = min + Math.floor(Math.random() * (max - min + 1))
  const shuffled = [...arr].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, Math.min(n, arr.length))
}

function randInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1))
}

function maybe<T>(value: T, probability = 0.5): T | undefined {
  return Math.random() < probability ? value : undefined
}

function isoDate(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, 'Z')
}

/** Clamp a date to not exceed 'now' minus a small buffer (avoids Zod future-timestamp rejection) */
function clampToPast(date: Date, now: Date): Date {
  const maxTs = now.getTime() - 60_000 // 1 min buffer
  if (date.getTime() > maxTs) {
    return new Date(maxTs)
  }
  return date
}

// ─── Data Pools ──────────────────────────────────────────────────────

const BREAKFAST_FOODS = [
  { name: 'Oatmeal', portion: '1 bowl' },
  { name: 'Scrambled eggs', portion: '2 eggs' },
  { name: 'Toast', portion: '2 slices' },
  { name: 'Greek yogurt', portion: '1 cup' },
  { name: 'Banana', portion: '1 medium' },
  { name: 'Granola', portion: '1/2 cup' },
  { name: 'Orange juice', portion: '1 glass' },
  { name: 'Coffee', portion: '1 cup' },
  { name: 'Avocado toast', portion: '1 slice' },
  { name: 'Smoothie', portion: '1 glass' },
  { name: 'Cereal', portion: '1 bowl' },
  { name: 'Pancakes', portion: '3 pancakes' },
  { name: 'Blueberries', portion: '1/2 cup' },
]

const LUNCH_FOODS = [
  { name: 'Chicken salad', portion: '1 plate' },
  { name: 'Turkey sandwich', portion: '1 sandwich' },
  { name: 'Soup', portion: '1 bowl' },
  { name: 'Rice bowl', portion: '1 bowl' },
  { name: 'Grilled chicken', portion: '1 breast' },
  { name: 'Caesar salad', portion: '1 plate' },
  { name: 'Burrito bowl', portion: '1 bowl' },
  { name: 'Pasta', portion: '1 plate' },
  { name: 'Sushi', portion: '8 pieces' },
  { name: 'Falafel wrap', portion: '1 wrap' },
  { name: 'Lentil soup', portion: '1 bowl' },
  { name: 'BLT sandwich', portion: '1 sandwich' },
]

const DINNER_FOODS = [
  { name: 'Grilled salmon', portion: '1 fillet' },
  { name: 'Steak', portion: '6 oz' },
  { name: 'Roasted vegetables', portion: '1 cup' },
  { name: 'Mashed potatoes', portion: '1 cup' },
  { name: 'Pasta with marinara', portion: '1 plate' },
  { name: 'Stir-fry', portion: '1 plate' },
  { name: 'Pizza', portion: '3 slices' },
  { name: 'Tacos', portion: '3 tacos' },
  { name: 'Curry with rice', portion: '1 plate' },
  { name: 'Baked chicken thighs', portion: '2 thighs' },
  { name: 'Fish and chips', portion: '1 plate' },
  { name: 'Risotto', portion: '1 bowl' },
  { name: 'Lamb chops', portion: '3 chops' },
  { name: 'Pad thai', portion: '1 plate' },
]

const SNACK_FOODS = [
  { name: 'Apple', portion: '1 medium' },
  { name: 'Almonds', portion: 'handful' },
  { name: 'Protein bar', portion: '1 bar' },
  { name: 'Cheese and crackers', portion: '4 crackers' },
  { name: 'Dark chocolate', portion: '2 squares' },
  { name: 'Hummus and carrots', portion: '1 serving' },
  { name: 'Trail mix', portion: 'handful' },
  { name: 'Popcorn', portion: '1 bag' },
  { name: 'Peanut butter toast', portion: '1 slice' },
]

// ── Primary trigger foods (will appear ≥5 times each, with symptoms following) ──
const PRIMARY_TRIGGERS = [
  { name: 'Ice cream', portion: '2 scoops' },
  { name: 'Spicy wings', portion: '6 wings' },
  { name: 'Garlic bread', portion: '3 pieces' },
]

// ── Secondary triggers (appear ~3 times, symptoms ~70% of the time) ──
const SECONDARY_TRIGGERS = [
  { name: 'Fried onion rings', portion: '1 serving' },
  { name: 'Bean burrito', portion: '1 burrito' },
  { name: 'Creamy pasta', portion: '1 plate' },
  { name: 'Milk', portion: '1 glass' },
]

const FOOD_MAP: Record<string, Array<{ name: string; portion?: string }>> = {
  breakfast: BREAKFAST_FOODS,
  lunch: LUNCH_FOODS,
  dinner: DINNER_FOODS,
  supper: DINNER_FOODS,
  snack: SNACK_FOODS,
}

const PORTION_SIZES = ['small', 'normal', 'large', 'huge'] as const
const SYMPTOM_TYPES = ['bloating', 'pain', 'nausea', 'gas', 'cramps', 'fatigue'] as const
const TRIGGER_SYMPTOM_TYPES = ['bloating', 'gas', 'cramps', 'pain'] as const
const LOCATIONS = ['upper_left', 'upper_right', 'lower_left', 'lower_right', 'central', 'all'] as const
const URGENCY_LEVELS = ['none', 'mild', 'moderate', 'severe'] as const
const IMPACT_SEVERITY = ['none', 'mild', 'moderate', 'severe'] as const
const ACTIVITIES = ['work', 'exercise', 'socializing', 'sleep', 'commute', 'cooking', 'errands'] as const

const MEAL_NOTES = [
  'Ate too fast',
  'Enjoyed this one',
  'Felt heavy after',
  'Tried a new recipe',
  'Leftovers from yesterday',
  'Ate out at a restaurant',
  'Meal prep from Sunday',
  undefined,
  undefined,
  undefined,
]

const SYMPTOM_NOTES = [
  'Started after lunch',
  'Woke up with this',
  'Gets worse when sitting',
  'Drinking water helped a bit',
  'Took antacid',
  'Same as yesterday',
  undefined,
  undefined,
]

const EMOTION_NOTES = [
  'Rough morning but got better',
  'Good day overall',
  'Stress from work deadlines',
  'Slept poorly last night',
  'Feeling anxious about tomorrow',
  'Great energy today',
  undefined,
  undefined,
  undefined,
]

const GENERAL_NOTES = [
  'Drank lots of water today',
  'Forgot to take probiotics',
  'Started new probiotic supplement',
  'Noticed a pattern with dairy',
  'Skipped breakfast — felt better?',
  'Trying to eat more slowly',
  'Stressful meeting, stomach reacted',
  'Long walk after dinner helped',
  'Need to cut back on coffee',
  'Feeling much better this week overall',
]

// ─── Entry Generators ────────────────────────────────────────────────
// Each returns a plain object matching the Zod entrySchema input shape.
// undefined fields are stripped by JSON.stringify automatically.

function makeMeal(
  date: Date,
  hour: number,
  mealType: string,
  triggerFood?: { name: string; portion?: string },
): Record<string, unknown> {
  const ts = new Date(date)
  ts.setUTCHours(hour, randInt(0, 45), 0, 0)

  const pool = FOOD_MAP[mealType] || LUNCH_FOODS
  const foods = pickN(pool, 1, 3)
  if (triggerFood) {
    foods.push(triggerFood)
  }

  return {
    type: 'meal',
    timestamp: isoDate(ts),
    mealType,
    foods,
    portionSize: maybe(pick([...PORTION_SIZES]), 0.4),
    notes: pick(MEAL_NOTES),
  }
}

function makeSymptom(date: Date, hour: number, minute?: number, severityOverride?: number, symptomTypeOverride?: string): Record<string, unknown> {
  const ts = new Date(date)
  ts.setUTCHours(hour, minute ?? randInt(0, 59), 0, 0)

  return {
    type: 'symptom',
    timestamp: isoDate(ts),
    symptomType: symptomTypeOverride ?? pick([...SYMPTOM_TYPES]),
    severity: severityOverride ?? randInt(1, 5),
    location: maybe(pick([...LOCATIONS]), 0.6),
    duration: maybe(randInt(10, 180), 0.5),
    notes: pick(SYMPTOM_NOTES),
  }
}

function makeBowel(date: Date, hour: number, bristolOverride?: number): Record<string, unknown> {
  const ts = new Date(date)
  ts.setUTCHours(hour, randInt(0, 30), 0, 0)

  return {
    type: 'bowel',
    timestamp: isoDate(ts),
    bristolType: bristolOverride ?? randInt(1, 7),
    urgency: maybe(pick([...URGENCY_LEVELS]), 0.6),
    blood: maybe(false, 0.1),
    mucus: maybe(false, 0.15),
  }
}

function makeEmotion(date: Date, hour: number): Record<string, unknown> {
  const ts = new Date(date)
  ts.setUTCHours(hour, 0, 0, 0)

  return {
    type: 'emotion',
    timestamp: isoDate(ts),
    mood: randInt(1, 5),
    stressLevel: maybe(randInt(1, 5), 0.7),
    sleepQuality: maybe(randInt(1, 5), 0.6),
    anxietyLevel: maybe(randInt(1, 5), 0.5),
    notes: pick(EMOTION_NOTES),
  }
}

function makeImpact(date: Date, hour: number, sev: string): Record<string, unknown> {
  const ts = new Date(date)
  ts.setUTCHours(hour, randInt(0, 59), 0, 0)

  const descriptions: Record<string, string[]> = {
    none: ['No issues today', 'Feeling great, no impact'],
    mild: ['Slight discomfort but manageable', 'Minor bloating slowed me down a little'],
    moderate: ['Had to skip my workout', 'Took it easy this afternoon', "Couldn't focus at work"],
    severe: ['Stayed home from work', 'Cancelled plans due to symptoms', 'Spent most of the day resting'],
  }

  return {
    type: 'impact',
    timestamp: isoDate(ts),
    impactSeverity: sev,
    affectedActivities: sev === 'none' ? undefined : pickN([...ACTIVITIES], 1, 3),
    description: sev === 'none' ? undefined : maybe(pick(descriptions[sev] || []), 0.7),
  }
}

function makeNote(date: Date, hour: number): Record<string, unknown> {
  const ts = new Date(date)
  ts.setUTCHours(hour, randInt(0, 59), 0, 0)

  return {
    type: 'note',
    timestamp: isoDate(ts),
    notes: pick(GENERAL_NOTES),
  }
}

// ─── Trigger Scheduling ─────────────────────────────────────────────
// Pre-plan which days get trigger foods to ensure sufficient counts.
//
// Correlation engine requirements:
//   - Food must appear ≥3 times (MIN_OCCURRENCES)
//   - Symptoms must follow within 6 hours (WINDOW_HOURS)
//   - confidence = RR_norm*0.4 + sample_size*0.3 + consistency*0.3
//   - Must exceed 0.3 confidence threshold
//
// Strategy:
//   Primary triggers: appear on 6–8 days, symptoms follow ~85% of the time
//   Secondary triggers: appear on 3–4 days, symptoms follow ~70% of the time
//   Safe foods (oatmeal, chicken salad, etc.) appear often with NO symptoms
//     → gives low P(symptom|¬food) baseline → amplifies relative risk

interface TriggerDay {
  dayOffset: number
  trigger: { name: string; portion?: string }
  mealSlot: 'lunch' | 'dinner'
  willCauseSymptom: boolean
}

function scheduleTriggers(): TriggerDay[] {
  const schedule: TriggerDay[] = []

  // Primary triggers: 6–8 appearances, ~85% symptom rate
  for (const trigger of PRIMARY_TRIGGERS) {
    const dayCount = randInt(6, 8)
    // Spread across 30 days, avoid clustering
    const availableDays = Array.from({ length: 30 }, (_, i) => i)
    const selectedDays = pickN(availableDays, dayCount, dayCount)

    for (let i = 0; i < selectedDays.length; i++) {
      schedule.push({
        dayOffset: selectedDays[i],
        trigger,
        mealSlot: pick(['lunch', 'dinner']),
        willCauseSymptom: Math.random() < 0.85,
      })
    }
  }

  // Secondary triggers: 3–5 appearances, ~70% symptom rate
  for (const trigger of SECONDARY_TRIGGERS) {
    const dayCount = randInt(3, 5)
    const availableDays = Array.from({ length: 30 }, (_, i) => i)
    const selectedDays = pickN(availableDays, dayCount, dayCount)

    for (let i = 0; i < selectedDays.length; i++) {
      schedule.push({
        dayOffset: selectedDays[i],
        trigger,
        mealSlot: pick(['lunch', 'dinner']),
        willCauseSymptom: Math.random() < 0.7,
      })
    }
  }

  return schedule
}

// ─── Main Generation ─────────────────────────────────────────────────

function generate(): object {
  const now = new Date()
  const allEntries: Record<string, unknown>[] = []

  // Pre-schedule trigger food appearances
  const triggerSchedule = scheduleTriggers()

  // Index by day for quick lookup
  const triggersByDay = new Map<number, TriggerDay[]>()
  for (const td of triggerSchedule) {
    const existing = triggersByDay.get(td.dayOffset) || []
    existing.push(td)
    triggersByDay.set(td.dayOffset, existing)
  }

  for (let dayOffset = 30; dayOffset >= 1; dayOffset--) {
    const date = new Date(now)
    date.setDate(date.getDate() - dayOffset)
    date.setUTCHours(0, 0, 0, 0)

    const dayEntries: Record<string, unknown>[] = []
    const dayTriggers = triggersByDay.get(29 - dayOffset) || []
    const hasTrigger = dayTriggers.length > 0
    const willHaveSymptom = dayTriggers.some((t) => t.willCauseSymptom)

    // Determine day profile (bias toward bad on trigger days)
    const dayType = hasTrigger
      ? pick(['trigger', 'trigger', 'bad'])
      : pick(['good', 'good', 'good', 'normal', 'normal'])

    // ── Morning emotion check-in (most days) ──
    if (Math.random() < 0.8) {
      const emo = makeEmotion(date, randInt(7, 9))
      if (dayType === 'good') emo.mood = randInt(3, 5)
      if (dayType === 'bad' || willHaveSymptom) {
        emo.mood = randInt(1, 3)
        emo.stressLevel = maybe(randInt(3, 5), 0.8)
      }
      dayEntries.push(emo)
    }

    // ── Breakfast (most days, never trigger — keeps safe foods safe) ──
    if (Math.random() < 0.85) {
      dayEntries.push(makeMeal(date, randInt(7, 9), 'breakfast', undefined))
    }

    // ── Morning bowel (common) ──
    if (Math.random() < 0.7) {
      const bristolOverride =
        dayType === 'good' ? randInt(3, 5) :
        dayType === 'bad' ? pick([1, 2, 6, 7]) :
        undefined
      dayEntries.push(makeBowel(date, randInt(8, 10), bristolOverride))
    }

    // ── Lunch ──
    const lunchTriggers = dayTriggers.filter((t) => t.mealSlot === 'lunch')
    if (Math.random() < 0.9 || lunchTriggers.length > 0) {
      // Pick first trigger if any, otherwise no trigger
      const triggerFood = lunchTriggers.length > 0 ? lunchTriggers[0].trigger : undefined
      const lunchHour = randInt(11, 13)
      dayEntries.push(makeMeal(date, lunchHour, 'lunch', triggerFood))

      // Add symptom 1–4 hours after lunch if trigger causes symptom
      if (lunchTriggers.some((t) => t.willCauseSymptom)) {
        const symptomHour = lunchHour + randInt(1, 4)
        const symptomMin = randInt(0, 59)
        dayEntries.push(makeSymptom(date, symptomHour, symptomMin, randInt(2, 5), pick([...TRIGGER_SYMPTOM_TYPES])))
      }
    }

    // ── Afternoon symptom (random, non-trigger — only on truly bad days) ──
    if (!hasTrigger && dayType === 'normal' && Math.random() < 0.15) {
      dayEntries.push(makeSymptom(date, randInt(14, 16), undefined, randInt(1, 2)))
    }

    // ── Afternoon snack (sometimes) ──
    if (Math.random() < 0.4) {
      dayEntries.push(makeMeal(date, randInt(15, 16), 'snack', undefined))
    }

    // ── Dinner ──
    const dinnerTriggers = dayTriggers.filter((t) => t.mealSlot === 'dinner')
    if (Math.random() < 0.95 || dinnerTriggers.length > 0) {
      const triggerFood = dinnerTriggers.length > 0 ? dinnerTriggers[0].trigger : undefined
      const dinnerHour = randInt(18, 20)
      dayEntries.push(makeMeal(date, dinnerHour, 'dinner', triggerFood))

      // Add symptom 1–4 hours after dinner if trigger causes symptom
      if (dinnerTriggers.some((t) => t.willCauseSymptom)) {
        const symptomHour = dinnerHour + randInt(1, 4)
        const symptomMin = randInt(0, 59)
        if (symptomHour <= 23) {
          dayEntries.push(makeSymptom(date, symptomHour, symptomMin, randInt(2, 5), pick([...TRIGGER_SYMPTOM_TYPES])))
        }
      }
    }

    // ── Evening bowel (some days, more likely on bad days) ──
    if (Math.random() < (willHaveSymptom ? 0.5 : 0.25)) {
      const bristolOverride = willHaveSymptom ? pick([1, 6, 7]) : undefined
      dayEntries.push(makeBowel(date, randInt(19, 22), bristolOverride))
    }

    // ── Impact entry (more common on trigger days) ──
    if (willHaveSymptom && Math.random() < 0.6) {
      const sev = pick(['mild', 'moderate', 'severe'])
      dayEntries.push(makeImpact(date, randInt(20, 22), sev))
    } else if (!hasTrigger && Math.random() < 0.2) {
      dayEntries.push(makeImpact(date, randInt(20, 22), pick(['none', 'mild'])))
    }

    // ── General note (occasionally) ──
    if (Math.random() < 0.25) {
      dayEntries.push(makeNote(date, randInt(9, 21)))
    }

    // Sort by timestamp, clamp to past, and add
    dayEntries.sort((a, b) =>
      (a.timestamp as string).localeCompare(b.timestamp as string)
    )
    for (const entry of dayEntries) {
      const ts = new Date(entry.timestamp as string)
      entry.timestamp = isoDate(clampToPast(ts, now))
    }
    allEntries.push(...dayEntries)
  }

  return { entries: allEntries }
}

// ─── Run ──────────────────────────────────────────────────────────────

// Strip undefined values by round-tripping through JSON
console.log(JSON.stringify(generate(), null, 2))

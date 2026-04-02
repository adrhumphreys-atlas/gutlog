import { Hono } from 'hono'
import { drizzle } from 'drizzle-orm/d1'
import { eq, desc } from 'drizzle-orm'
import { entries, correlations } from '../db/schema'
import { authMiddleware } from '../middleware/auth'
import type { Env } from '../index'

type AuthVars = { userId: string }

export const insightRoutes = new Hono<{
  Bindings: Env
  Variables: AuthVars
}>()

insightRoutes.use('*', authMiddleware)

/**
 * GET /api/insights
 *
 * Returns correlations. Auto-refreshes if new entry data exists
 * since last correlation update (on-demand smart trigger).
 */
insightRoutes.get('/', async (c) => {
  const userId = c.get('userId')
  const db = drizzle(c.env.DB)

  // Get latest entry timestamp
  const [latestEntry] = await db
    .select({ timestamp: entries.timestamp })
    .from(entries)
    .where(eq(entries.userId, userId))
    .orderBy(desc(entries.timestamp))
    .limit(1)

  // Get latest correlation update
  const [latestCorrelation] = await db
    .select({ lastUpdatedAt: correlations.lastUpdatedAt })
    .from(correlations)
    .where(eq(correlations.userId, userId))
    .orderBy(desc(correlations.lastUpdatedAt))
    .limit(1)

  const needsRefresh =
    latestEntry &&
    (!latestCorrelation ||
      latestEntry.timestamp > latestCorrelation.lastUpdatedAt)

  if (needsRefresh) {
    await refreshCorrelations(db, userId)
  }

  // Return all correlations above confidence threshold
  const results = await db
    .select()
    .from(correlations)
    .where(eq(correlations.userId, userId))
    .orderBy(desc(correlations.confidence))

  return c.json({
    correlations: results,
    refreshed: needsRefresh,
  })
})

/**
 * POST /api/insights/refresh
 *
 * Force-recalculates correlations regardless of whether new entries exist.
 */
insightRoutes.post('/refresh', async (c) => {
  const userId = c.get('userId')
  const db = drizzle(c.env.DB)

  await refreshCorrelations(db, userId)

  const results = await db
    .select()
    .from(correlations)
    .where(eq(correlations.userId, userId))
    .orderBy(desc(correlations.confidence))

  return c.json({
    correlations: results,
    refreshed: true,
  })
})

// ─── Research-informed symptom onset windows ────────────────────────
//
// Based on gastrointestinal physiology and food-reaction research:
//
// • Nausea: Gastric/vagal response, onset 15 min – 3 hrs
//   (Ref: Tack et al., Gastroenterology 2006; Talley, Gut 2020)
//
// • Bloating & Gas: Colonic fermentation of FODMAPs/fiber,
//   onset 30 min – 4 hrs (Ref: Ong et al., JGLD 2010; Halmos et al., Gut 2014)
//
// • Cramps & Pain: Small intestine transit and visceral
//   hypersensitivity, onset 2 – 6 hrs (Ref: Simrén et al., Gut 2013)
//
// • Fatigue: Systemic immune/inflammatory response to food
//   antigens, onset 4 – 8 hrs (Ref: Zuo et al., Aliment Pharmacol Ther 2015)
//
// • Bowel changes: Full GI transit (small + large intestine),
//   onset 12 – 72 hrs; we use 24 hrs as practical window
//   (Ref: Degen & Phillips, Gut 1996)
//
// • Stress/mood → symptoms: HPA axis and gut-brain interaction,
//   can trigger within 0 – 24 hrs (Ref: Mayer et al., J Clin Invest 2015)
// ────────────────────────────────────────────────────────────────────

/** Time window in hours for each symptom type, based on typical onset times */
const SYMPTOM_WINDOWS: Record<string, number> = {
  nausea: 3,
  bloating: 4,
  gas: 4,
  cramps: 6,
  pain: 6,
  fatigue: 8,
  other: 6,
}

/** Window for food → abnormal bowel movement correlations */
const BOWEL_WINDOW_HOURS = 24

/** Window for mood/stress → symptom correlations */
const MOOD_SYMPTOM_WINDOW_HOURS = 24

/** Bristol stool types considered abnormal (constipation: 1-2, diarrhea: 6-7) */
const isAbnormalBristol = (type: number): boolean => type <= 2 || type >= 6

/**
 * Correlation Engine — Research-driven, per-symptom relative risk
 *
 * Computes three categories of correlations:
 *
 * 1. Food → Specific Symptom (per symptom type with variable windows)
 *    For each (food, symptom_type) pair logged ≥4 times:
 *      relative_risk = P(symptom_type within window | ate food)
 *                    / P(symptom_type within window | didn't eat food)
 *
 * 2. Food → Abnormal Bowel Movement (Bristol 1-2 or 6-7, 24hr window)
 *    Same relative risk approach against abnormal stool entries.
 *
 * 3. Stress/Mood → Symptom Flare (any symptom within 24hrs of
 *    high stress ≥4 or low mood ≤2)
 *
 * Confidence formula (unchanged weights):
 *   confidence = (rr_normalized * 0.4) + (sample_factor * 0.3) + (consistency * 0.3)
 *
 * GUARD: If P(symptom|¬trigger) = 0, use consistency ratio as confidence.
 */
async function refreshCorrelations(db: any, userId: string) {
  const MIN_OCCURRENCES = 4
  const MIN_CONFIDENCE = 0.3

  // TUNING NOTE: These are design choices, not research-validated values.
  // SAMPLE_SIZE_TARGET controls how quickly the sample-size term saturates
  // (reaches 1.0). 15 was chosen as a reasonable "feels reliable" threshold
  // for a personal food journal — it is not derived from a power calculation.
  const SAMPLE_SIZE_TARGET = 15

  // LOW_N_DAMPING_THRESHOLD: below this number of trigger occasions, a
  // multiplicative penalty is applied to confidence to prevent spurious
  // high-RR results from very thin data (e.g. n=4 with 4/4 hits looks
  // compelling but is almost certainly noise). At n=4 the multiplier is
  // 0.5; at n=6 it is 0.75; at n≥8 it is 1.0 (no penalty).
  const LOW_N_DAMPING_THRESHOLD = 8

  // Load all entries for this user into memory
  const allEntries = await db
    .select()
    .from(entries)
    .where(eq(entries.userId, userId))
    .orderBy(entries.timestamp)

  const mealEntries = allEntries.filter((e: any) => e.type === 'meal')
  const symptomEntries = allEntries.filter((e: any) => e.type === 'symptom')
  const bowelEntries = allEntries.filter((e: any) => e.type === 'bowel')
  const emotionEntries = allEntries.filter((e: any) => e.type === 'emotion')

  const now = new Date().toISOString()
  const newCorrelations: any[] = []

  // Safely parse foods — D1 may return JSON string or parsed array
  const parseFoods = (raw: unknown): Array<{ name: string }> => {
    if (!raw) return []
    if (typeof raw === 'string') {
      try { return JSON.parse(raw) } catch { return [] }
    }
    if (Array.isArray(raw)) return raw
    return []
  }

  // Helper: compute relative risk and confidence for a trigger/outcome pair
  const computeCorrelation = (
    triggerOccasions: any[],       // meals/events where trigger was present
    nonTriggerOccasions: any[],    // meals/events where trigger was absent
    outcomeEntries: any[],         // symptom/bowel entries to check against
    windowHours: number,
    triggerCount: number,
    outcomeMatcher: (outcome: any, startMs: number, endMs: number) => boolean,
  ): { relativeRisk: number; confidence: number; consistency: number; occurrences: number } | null => {
    let outcomeAfterTrigger = 0
    for (const occasion of triggerOccasions) {
      const t = new Date(occasion.timestamp).getTime()
      const windowEnd = t + windowHours * 3600_000
      if (outcomeEntries.some((o: any) => outcomeMatcher(o, t, windowEnd))) {
        outcomeAfterTrigger++
      }
    }

    let outcomeAfterNoTrigger = 0
    for (const occasion of nonTriggerOccasions) {
      const t = new Date(occasion.timestamp).getTime()
      const windowEnd = t + windowHours * 3600_000
      if (outcomeEntries.some((o: any) => outcomeMatcher(o, t, windowEnd))) {
        outcomeAfterNoTrigger++
      }
    }

    const pOutcomeGivenTrigger =
      triggerOccasions.length > 0 ? outcomeAfterTrigger / triggerOccasions.length : 0
    const pOutcomeGivenNoTrigger =
      nonTriggerOccasions.length > 0 ? outcomeAfterNoTrigger / nonTriggerOccasions.length : 0

    const consistency = triggerOccasions.length > 0
      ? outcomeAfterTrigger / triggerOccasions.length
      : 0
    const sampleSizeFactor = Math.min(triggerCount / SAMPLE_SIZE_TARGET, 1.0)

    let relativeRisk: number
    let confidence: number

    if (pOutcomeGivenNoTrigger === 0) {
      relativeRisk = pOutcomeGivenTrigger > 0 ? 10 : 1
      confidence = consistency
    } else {
      relativeRisk = pOutcomeGivenTrigger / pOutcomeGivenNoTrigger
      // NOTE: The 0.4 / 0.3 / 0.3 weights below are tuning choices, not
      // research-validated values. They reflect a deliberate preference for
      // relative risk (40%) as the primary signal, with sample size and
      // consistency as secondary moderators.
      const rrNormalized = Math.min(relativeRisk / 5, 1.0)
      confidence =
        rrNormalized * 0.4 + sampleSizeFactor * 0.3 + consistency * 0.3
    }

    // Multiplicative low-n damping: prevent spuriously high confidence from
    // very thin data. This is applied after the weighted formula so it acts
    // as a hard gate rather than just one additive term that can be
    // outweighed by a high RR or perfect consistency.
    const lowNDamping = Math.min(triggerCount / LOW_N_DAMPING_THRESHOLD, 1.0)
    confidence = confidence * lowNDamping

    if (confidence < MIN_CONFIDENCE) return null

    return {
      relativeRisk: Math.round(relativeRisk * 1000) / 1000,
      confidence: Math.round(confidence * 1000) / 1000,
      consistency: Math.round(consistency * 1000) / 1000,
      occurrences: outcomeAfterTrigger,
    }
  }

  // ─── 1. Food → Specific Symptom Type ────────────────────────────────

  if (mealEntries.length >= 5 && symptomEntries.length >= 3) {
    // Extract unique food items
    const foodCounts = new Map<string, number>()
    for (const meal of mealEntries) {
      const foods = parseFoods(meal.foods)
      for (const food of foods) {
        const name = food.name.toLowerCase().trim()
        foodCounts.set(name, (foodCounts.get(name) || 0) + 1)
      }
    }

    // Get unique symptom types actually logged by this user
    const loggedSymptomTypes = new Set<string>(
      symptomEntries.map((s: any) => s.symptomType).filter(Boolean)
    )

    for (const [foodName, count] of foodCounts) {
      if (count < MIN_OCCURRENCES) continue

      const mealsWithFood = mealEntries.filter((m: any) =>
        parseFoods(m.foods).some(
          (f) => f.name.toLowerCase().trim() === foodName
        )
      )
      const mealsWithoutFood = mealEntries.filter(
        (m: any) =>
          !parseFoods(m.foods).some(
            (f) => f.name.toLowerCase().trim() === foodName
          )
      )

      // Analyze each symptom type separately with its research-based window
      for (const symptomType of loggedSymptomTypes) {
        const windowHours = SYMPTOM_WINDOWS[symptomType] ?? SYMPTOM_WINDOWS.other
        const symptomsOfType = symptomEntries.filter(
          (s: any) => s.symptomType === symptomType
        )

        if (symptomsOfType.length < 2) continue // need minimum symptom instances

        const result = computeCorrelation(
          mealsWithFood,
          mealsWithoutFood,
          symptomsOfType,
          windowHours,
          count,
          (s, startMs, endMs) => {
            const sTime = new Date(s.timestamp).getTime()
            return sTime > startMs && sTime <= endMs
          },
        )

        if (result) {
          newCorrelations.push({
            id: crypto.randomUUID(),
            userId,
            triggerType: 'food',
            triggerValue: foodName,
            symptomType,
            confidence: result.confidence,
            relativeRisk: result.relativeRisk,
            consistencyRatio: result.consistency,
            occurrences: result.occurrences,
            totalOpportunities: mealsWithFood.length,
            windowHours,
            createdAt: now,
            lastUpdatedAt: now,
          })
        }
      }
    }
  }

  // ─── 2. Food → Abnormal Bowel Movement ──────────────────────────────

  if (mealEntries.length >= 5 && bowelEntries.length >= 3) {
    const abnormalBowelEntries = bowelEntries.filter(
      (b: any) => b.bristolType != null && isAbnormalBristol(b.bristolType)
    )

    if (abnormalBowelEntries.length >= 2) {
      const foodCounts = new Map<string, number>()
      for (const meal of mealEntries) {
        const foods = parseFoods(meal.foods)
        for (const food of foods) {
          const name = food.name.toLowerCase().trim()
          foodCounts.set(name, (foodCounts.get(name) || 0) + 1)
        }
      }

      for (const [foodName, count] of foodCounts) {
        if (count < MIN_OCCURRENCES) continue

        const mealsWithFood = mealEntries.filter((m: any) =>
          parseFoods(m.foods).some(
            (f) => f.name.toLowerCase().trim() === foodName
          )
        )
        const mealsWithoutFood = mealEntries.filter(
          (m: any) =>
            !parseFoods(m.foods).some(
              (f) => f.name.toLowerCase().trim() === foodName
            )
        )

        const result = computeCorrelation(
          mealsWithFood,
          mealsWithoutFood,
          abnormalBowelEntries,
          BOWEL_WINDOW_HOURS,
          count,
          (b, startMs, endMs) => {
            const bTime = new Date(b.timestamp).getTime()
            return bTime > startMs && bTime <= endMs
          },
        )

        if (result) {
          newCorrelations.push({
            id: crypto.randomUUID(),
            userId,
            triggerType: 'food',
            triggerValue: foodName,
            symptomType: 'abnormal_bowel',
            confidence: result.confidence,
            relativeRisk: result.relativeRisk,
            consistencyRatio: result.consistency,
            occurrences: result.occurrences,
            totalOpportunities: mealsWithFood.length,
            windowHours: BOWEL_WINDOW_HOURS,
            createdAt: now,
            lastUpdatedAt: now,
          })
        }
      }
    }
  }

  // ─── 3. Stress/Mood → Symptom Flare ─────────────────────────────────

  if (emotionEntries.length >= 3 && symptomEntries.length >= 3) {
    // High-stress events: stressLevel ≥ 4 or anxietyLevel ≥ 4
    const highStressEntries = emotionEntries.filter(
      (e: any) => (e.stressLevel != null && e.stressLevel >= 4) ||
                  (e.anxietyLevel != null && e.anxietyLevel >= 4)
    )
    const lowStressEntries = emotionEntries.filter(
      (e: any) => !((e.stressLevel != null && e.stressLevel >= 4) ||
                    (e.anxietyLevel != null && e.anxietyLevel >= 4))
    )

    if (highStressEntries.length >= 3 && lowStressEntries.length >= 1) {
      const result = computeCorrelation(
        highStressEntries,
        lowStressEntries,
        symptomEntries,
        MOOD_SYMPTOM_WINDOW_HOURS,
        highStressEntries.length,
        (s, startMs, endMs) => {
          const sTime = new Date(s.timestamp).getTime()
          return sTime > startMs && sTime <= endMs
        },
      )

      if (result) {
        newCorrelations.push({
          id: crypto.randomUUID(),
          userId,
          triggerType: 'emotion',
          triggerValue: 'high_stress',
          symptomType: 'any',
          confidence: result.confidence,
          relativeRisk: result.relativeRisk,
          consistencyRatio: result.consistency,
          occurrences: result.occurrences,
          totalOpportunities: highStressEntries.length,
          windowHours: MOOD_SYMPTOM_WINDOW_HOURS,
          createdAt: now,
          lastUpdatedAt: now,
        })
      }
    }

    // Low-mood events: mood ≤ 2
    const lowMoodEntries = emotionEntries.filter(
      (e: any) => e.mood != null && e.mood <= 2
    )
    const nonLowMoodEntries = emotionEntries.filter(
      (e: any) => !(e.mood != null && e.mood <= 2)
    )

    if (lowMoodEntries.length >= 3 && nonLowMoodEntries.length >= 1) {
      const result = computeCorrelation(
        lowMoodEntries,
        nonLowMoodEntries,
        symptomEntries,
        MOOD_SYMPTOM_WINDOW_HOURS,
        lowMoodEntries.length,
        (s, startMs, endMs) => {
          const sTime = new Date(s.timestamp).getTime()
          return sTime > startMs && sTime <= endMs
        },
      )

      if (result) {
        newCorrelations.push({
          id: crypto.randomUUID(),
          userId,
          triggerType: 'emotion',
          triggerValue: 'low_mood',
          symptomType: 'any',
          confidence: result.confidence,
          relativeRisk: result.relativeRisk,
          consistencyRatio: result.consistency,
          occurrences: result.occurrences,
          totalOpportunities: lowMoodEntries.length,
          windowHours: MOOD_SYMPTOM_WINDOW_HOURS,
          createdAt: now,
          lastUpdatedAt: now,
        })
      }
    }
  }

  // ─── Deduplicate: keep best correlation per (triggerValue, symptomType)
  const bestByKey = new Map<string, any>()
  for (const corr of newCorrelations) {
    const key = `${corr.triggerType}:${corr.triggerValue}:${corr.symptomType}`
    const existing = bestByKey.get(key)
    if (!existing || corr.confidence > existing.confidence) {
      bestByKey.set(key, corr)
    }
  }
  const dedupedCorrelations = Array.from(bestByKey.values())

  // Replace old correlations with new ones
  await db.delete(correlations).where(eq(correlations.userId, userId))

  // Insert in batches to avoid D1's SQL variable limit
  const BATCH_SIZE = 5
  for (let i = 0; i < dedupedCorrelations.length; i += BATCH_SIZE) {
    const batch = dedupedCorrelations.slice(i, i + BATCH_SIZE)
    await db.insert(correlations).values(batch)
  }
}

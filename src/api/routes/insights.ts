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
 * Correlation Engine — In-memory relative risk calculation
 *
 * For each food item logged ≥3 times:
 *   relative_risk = P(symptom within N hours | ate food X)
 *                 / P(symptom within N hours | did NOT eat food X)
 *
 *   confidence = (relative_risk_normalized * 0.4)
 *              + (sample_size_factor * 0.3)
 *              + (consistency * 0.3)
 *
 * GUARD: If P(symptom|¬food) = 0, use consistency ratio as confidence.
 */
async function refreshCorrelations(db: any, userId: string) {
  const WINDOW_HOURS = 6
  const MIN_OCCURRENCES = 3
  const MIN_CONFIDENCE = 0.3

  // Load all entries for this user into memory
  const allEntries = await db
    .select()
    .from(entries)
    .where(eq(entries.userId, userId))
    .orderBy(entries.timestamp)

  const mealEntries = allEntries.filter((e: any) => e.type === 'meal')
  const symptomEntries = allEntries.filter((e: any) => e.type === 'symptom')

  if (mealEntries.length < 5 || symptomEntries.length < 3) {
    return // Not enough data
  }

  // Extract unique food items
  const foodCounts = new Map<string, number>()
  for (const meal of mealEntries) {
    const foods = (meal.foods as Array<{ name: string }>) || []
    for (const food of foods) {
      const name = food.name.toLowerCase().trim()
      foodCounts.set(name, (foodCounts.get(name) || 0) + 1)
    }
  }

  const now = new Date().toISOString()
  const newCorrelations: any[] = []

  for (const [foodName, count] of foodCounts) {
    if (count < MIN_OCCURRENCES) continue

    // Meals where this food was eaten
    const mealsWithFood = mealEntries.filter((m: any) =>
      ((m.foods as Array<{ name: string }>) || []).some(
        (f) => f.name.toLowerCase().trim() === foodName
      )
    )

    // Meals where this food was NOT eaten
    const mealsWithoutFood = mealEntries.filter(
      (m: any) =>
        !((m.foods as Array<{ name: string }>) || []).some(
          (f) => f.name.toLowerCase().trim() === foodName
        )
    )

    // Count symptoms within window after eating food
    let symptomsAfterFood = 0
    for (const meal of mealsWithFood) {
      const mealTime = new Date(meal.timestamp).getTime()
      const windowEnd = mealTime + WINDOW_HOURS * 60 * 60 * 1000
      const hasSymptom = symptomEntries.some((s: any) => {
        const sTime = new Date(s.timestamp).getTime()
        return sTime > mealTime && sTime <= windowEnd
      })
      if (hasSymptom) symptomsAfterFood++
    }

    // Count symptoms within window after NOT eating food
    let symptomsAfterNoFood = 0
    for (const meal of mealsWithoutFood) {
      const mealTime = new Date(meal.timestamp).getTime()
      const windowEnd = mealTime + WINDOW_HOURS * 60 * 60 * 1000
      const hasSymptom = symptomEntries.some((s: any) => {
        const sTime = new Date(s.timestamp).getTime()
        return sTime > mealTime && sTime <= windowEnd
      })
      if (hasSymptom) symptomsAfterNoFood++
    }

    const pSymptomGivenFood =
      mealsWithFood.length > 0 ? symptomsAfterFood / mealsWithFood.length : 0
    const pSymptomGivenNoFood =
      mealsWithoutFood.length > 0
        ? symptomsAfterNoFood / mealsWithoutFood.length
        : 0

    const consistency = symptomsAfterFood / mealsWithFood.length
    const sampleSizeFactor = Math.min(count / 10, 1.0)

    let relativeRisk: number
    let confidence: number

    if (pSymptomGivenNoFood === 0) {
      // GUARD: division by zero — food eaten every day or no baseline symptoms
      relativeRisk = pSymptomGivenFood > 0 ? 10 : 1 // cap at 10
      confidence = consistency // use consistency as confidence
    } else {
      relativeRisk = pSymptomGivenFood / pSymptomGivenNoFood
      const rrNormalized = Math.min(relativeRisk / 5, 1.0) // normalize to 0-1
      confidence =
        rrNormalized * 0.4 + sampleSizeFactor * 0.3 + consistency * 0.3
    }

    if (confidence < MIN_CONFIDENCE) continue

    newCorrelations.push({
      id: crypto.randomUUID(),
      userId,
      triggerType: 'food',
      triggerValue: foodName,
      symptomType: 'any', // simplified — could break down by symptom type
      confidence: Math.round(confidence * 1000) / 1000,
      relativeRisk: Math.round(relativeRisk * 1000) / 1000,
      consistencyRatio: Math.round(consistency * 1000) / 1000,
      occurrences: symptomsAfterFood,
      totalOpportunities: mealsWithFood.length,
      windowHours: WINDOW_HOURS,
      createdAt: now,
      lastUpdatedAt: now,
    })
  }

  // Replace old correlations with new ones
  await db.delete(correlations).where(eq(correlations.userId, userId))

  if (newCorrelations.length > 0) {
    await db.insert(correlations).values(newCorrelations)
  }
}

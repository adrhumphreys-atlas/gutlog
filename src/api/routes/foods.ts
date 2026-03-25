import { Hono } from 'hono'
import { drizzle } from 'drizzle-orm/d1'
import { eq, and, gte, desc } from 'drizzle-orm'
import { entries } from '../db/schema'
import { authMiddleware } from '../middleware/auth'
import type { Env } from '../index'

type AuthVars = { userId: string }

export const foodRoutes = new Hono<{
  Bindings: Env
  Variables: AuthVars
}>()

foodRoutes.use('*', authMiddleware)

/**
 * GET /api/foods/autocomplete?q=chic
 * Food suggestions derived from entry history.
 * Ranked by: (1) frequency, (2) recency, (3) LIKE prefix match
 * Max 5 suggestions. Activates after ≥5 meal entries.
 */
foodRoutes.get('/autocomplete', async (c) => {
  const userId = c.get('userId')
  const query = c.req.query('q')?.toLowerCase().trim()
  const db = drizzle(c.env.DB)

  const mealEntries = await db
    .select({ foods: entries.foods, timestamp: entries.timestamp })
    .from(entries)
    .where(and(eq(entries.userId, userId), eq(entries.type, 'meal')))
    .orderBy(desc(entries.timestamp))

  if (mealEntries.length < 5) {
    return c.json({ suggestions: [] })
  }

  // Build frequency + recency map
  const foodMap = new Map<string, { count: number; lastUsed: string }>()

  for (const meal of mealEntries) {
    const foods = (meal.foods as Array<{ name: string }>) || []
    for (const food of foods) {
      const name = food.name.toLowerCase().trim()
      const existing = foodMap.get(name)
      if (existing) {
        existing.count++
        if (meal.timestamp > existing.lastUsed) {
          existing.lastUsed = meal.timestamp
        }
      } else {
        foodMap.set(name, { count: 1, lastUsed: meal.timestamp })
      }
    }
  }

  let candidates = Array.from(foodMap.entries()).map(([name, data]) => ({
    name,
    ...data,
  }))

  // Filter by query if provided (LIKE prefix/substring match)
  if (query) {
    candidates = candidates.filter((f) => f.name.includes(query))
  }

  // Sort: frequency desc, then recency desc
  candidates.sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count
    return b.lastUsed.localeCompare(a.lastUsed)
  })

  return c.json({ suggestions: candidates.slice(0, 5).map((f) => f.name) })
})

/**
 * GET /api/foods/recent
 * Top 3 most-logged foods from last 7 days, for quick-tap chips
 */
foodRoutes.get('/recent', async (c) => {
  const userId = c.get('userId')
  const db = drizzle(c.env.DB)
  const sevenDaysAgo = new Date(
    Date.now() - 7 * 24 * 60 * 60 * 1000
  ).toISOString()

  const recentMeals = await db
    .select({ foods: entries.foods })
    .from(entries)
    .where(
      and(
        eq(entries.userId, userId),
        eq(entries.type, 'meal'),
        gte(entries.timestamp, sevenDaysAgo)
      )
    )

  const foodCounts = new Map<string, number>()
  for (const meal of recentMeals) {
    const foods = (meal.foods as Array<{ name: string }>) || []
    for (const food of foods) {
      const name = food.name.toLowerCase().trim()
      foodCounts.set(name, (foodCounts.get(name) || 0) + 1)
    }
  }

  const top3 = Array.from(foodCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name]) => name)

  return c.json({ recent: top3 })
})

import { Hono } from 'hono'
import { drizzle } from 'drizzle-orm/d1'
import { eq, desc } from 'drizzle-orm'
import { entries } from '../db/schema'
import { authMiddleware } from '../middleware/auth'
import type { Env } from '../index'

type AuthVars = { userId: string }

export const streakRoutes = new Hono<{
  Bindings: Env
  Variables: AuthVars
}>()

streakRoutes.use('*', authMiddleware)

/**
 * GET /api/streak
 * Current logging streak — consecutive days with at least one entry.
 * Derived at read time, no cache.
 */
streakRoutes.get('/', async (c) => {
  const userId = c.get('userId')
  const db = drizzle(c.env.DB)

  const allEntries = await db
    .select({ timestamp: entries.timestamp })
    .from(entries)
    .where(eq(entries.userId, userId))
    .orderBy(desc(entries.timestamp))

  if (allEntries.length === 0) {
    return c.json({ streak: 0 })
  }

  // Get unique dates (in user's local context — using UTC date part for now)
  const uniqueDates = [
    ...new Set(allEntries.map((e) => e.timestamp.split('T')[0])),
  ].sort((a, b) => b.localeCompare(a)) // descending

  // Count consecutive days from today backwards
  const today = new Date().toISOString().split('T')[0]
  let streak = 0
  let expectedDate = today

  for (const date of uniqueDates) {
    if (date === expectedDate) {
      streak++
      // Move to previous day
      const d = new Date(expectedDate)
      d.setDate(d.getDate() - 1)
      expectedDate = d.toISOString().split('T')[0]
    } else if (date < expectedDate) {
      // Gap found — if we haven't started counting yet (no entry today),
      // check if yesterday had an entry
      if (streak === 0 && date === getPreviousDay(today)) {
        streak++
        const d = new Date(date)
        d.setDate(d.getDate() - 1)
        expectedDate = d.toISOString().split('T')[0]
      } else {
        break
      }
    }
  }

  return c.json({ streak })
})

function getPreviousDay(dateStr: string): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() - 1)
  return d.toISOString().split('T')[0]
}

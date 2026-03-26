import { Hono } from 'hono'
import { drizzle } from 'drizzle-orm/d1'
import { eq, desc } from 'drizzle-orm'
import { entries } from '../db/schema'
import { authMiddleware } from '../middleware/auth'
import type { Env } from '../index'

type AuthVars = { userId: string }

/** Validate an IANA timezone string. Falls back to 'UTC'. */
function parseTz(tz: string | undefined): string {
  if (!tz) return 'UTC'
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz })
    return tz
  } catch {
    return 'UTC'
  }
}

/** Get the local date string (YYYY-MM-DD) for a UTC ISO timestamp in a given timezone. */
function utcToLocalDate(utcTimestamp: string, tz: string): string {
  const d = new Date(utcTimestamp)
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  return formatter.format(d)
}

export const streakRoutes = new Hono<{
  Bindings: Env
  Variables: AuthVars
}>()

streakRoutes.use('*', authMiddleware)

/**
 * GET /api/streak?tz=Australia/Sydney
 * Current logging streak — consecutive days with at least one entry.
 * Uses the user's timezone to determine day boundaries.
 */
streakRoutes.get('/', async (c) => {
  const userId = c.get('userId')
  const db = drizzle(c.env.DB)
  const tz = parseTz(c.req.query('tz'))

  const allEntries = await db
    .select({ timestamp: entries.timestamp })
    .from(entries)
    .where(eq(entries.userId, userId))
    .orderBy(desc(entries.timestamp))

  if (allEntries.length === 0) {
    return c.json({ streak: 0 })
  }

  // Get unique dates in the user's local timezone
  const uniqueDates = [
    ...new Set(allEntries.map((e) => utcToLocalDate(e.timestamp, tz))),
  ].sort((a, b) => b.localeCompare(a)) // descending

  // Count consecutive days from today backwards
  const today = utcToLocalDate(new Date().toISOString(), tz)
  let streak = 0
  let expectedDate = today

  for (const date of uniqueDates) {
    if (date === expectedDate) {
      streak++
      // Move to previous day
      const d = new Date(expectedDate + 'T12:00:00') // noon to avoid DST issues
      d.setDate(d.getDate() - 1)
      expectedDate = utcToLocalDate(d.toISOString(), tz)
    } else if (date < expectedDate) {
      // Gap found — if we haven't started counting yet (no entry today),
      // check if yesterday had an entry
      if (streak === 0 && date === getPreviousDay(today, tz)) {
        streak++
        const d = new Date(date + 'T12:00:00')
        d.setDate(d.getDate() - 1)
        expectedDate = utcToLocalDate(d.toISOString(), tz)
      } else {
        break
      }
    }
  }

  return c.json({ streak })
})

function getPreviousDay(dateStr: string, tz: string): string {
  const d = new Date(dateStr + 'T12:00:00') // noon to avoid DST edge cases
  d.setDate(d.getDate() - 1)
  return utcToLocalDate(d.toISOString(), tz)
}

import { Hono } from 'hono'
import { drizzle } from 'drizzle-orm/d1'
import { eq, and, gte, lt, desc } from 'drizzle-orm'
import { entries, correlations, experiments } from '../db/schema'
import { entrySchema } from '../../shared/validation'
import { authMiddleware } from '../middleware/auth'
import type { Env } from '../index'

type AuthVars = { userId: string }

/**
 * Compute UTC start/end ISO strings for a given local date in a timezone.
 * E.g. date="2026-03-26", tz="Australia/Sydney" →
 *   start = "2026-03-25T13:00:00.000Z" (midnight AEDT in UTC)
 *   end   = "2026-03-26T13:00:00.000Z" (next midnight AEDT in UTC)
 */
function getUtcBoundsForLocalDate(date: string, tz: string): { start: string; end: string } {
  // Build a Date for midnight of `date` in the given timezone.
  // We use Intl.DateTimeFormat to find the UTC offset at that moment.
  const [year, month, day] = date.split('-').map(Number)

  // Create a rough UTC date, then use the formatter to determine the actual offset
  const rough = new Date(Date.UTC(year, month - 1, day, 12, 0, 0)) // noon UTC as a safe starting point

  // Format components in the target timezone to find the offset
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })

  // To find midnight of `date` in `tz`, we iterate:
  // Get what the rough date looks like in tz, then compute the offset.
  const parts = formatter.formatToParts(rough)
  const get = (type: string) => parseInt(parts.find(p => p.type === type)?.value || '0')
  const tzYear = get('year')
  const tzMonth = get('month')
  const tzDay = get('day')
  const tzHour = get('hour')
  const tzMinute = get('minute')
  const tzSecond = get('second')

  // The rough UTC date shows as (tzYear-tzMonth-tzDay tzHour:tzMinute:tzSecond) in tz.
  // We need midnight of (year-month-day) in tz.
  // offset = rough_utc - tz_local, so tz_local = rough_utc - offset
  // We want: target_utc = midnight_local + offset
  // Since rough_utc shows as tz_local, offset_ms = rough_utc_ms - tz_local_as_utc_ms
  const tzLocalAsUtc = Date.UTC(tzYear, tzMonth - 1, tzDay, tzHour === 24 ? 0 : tzHour, tzMinute, tzSecond)
  const offsetMs = rough.getTime() - tzLocalAsUtc

  // Midnight of the requested date in UTC
  const midnightLocal = Date.UTC(year, month - 1, day, 0, 0, 0)
  const startUtc = new Date(midnightLocal + offsetMs)

  // For the end, compute midnight of next day in the timezone
  // (offset may differ due to DST, so recalculate)
  const nextDay = new Date(Date.UTC(year, month - 1, day + 1, 12, 0, 0))
  const nextParts = formatter.formatToParts(nextDay)
  const getN = (type: string) => parseInt(nextParts.find(p => p.type === type)?.value || '0')
  const ntzYear = getN('year')
  const ntzMonth = getN('month')
  const ntzDay = getN('day')
  const ntzHour = getN('hour')
  const ntzMinute = getN('minute')
  const ntzSecond = getN('second')
  const ntzLocalAsUtc = Date.UTC(ntzYear, ntzMonth - 1, ntzDay, ntzHour === 24 ? 0 : ntzHour, ntzMinute, ntzSecond)
  const nextOffsetMs = nextDay.getTime() - ntzLocalAsUtc
  const midnightNextLocal = Date.UTC(year, month - 1, day + 1, 0, 0, 0)
  const endUtc = new Date(midnightNextLocal + nextOffsetMs)

  return {
    start: startUtc.toISOString(),
    end: endUtc.toISOString(),
  }
}

/**
 * Get the local date string (YYYY-MM-DD) for a UTC ISO timestamp in a given timezone.
 */
function utcToLocalDate(utcTimestamp: string, tz: string): string {
  const d = new Date(utcTimestamp)
  const formatter = new Intl.DateTimeFormat('en-CA', { // en-CA gives YYYY-MM-DD format
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  return formatter.format(d)
}

/**
 * Get today's date string (YYYY-MM-DD) in a given timezone.
 */
function todayInTz(tz: string): string {
  return utcToLocalDate(new Date().toISOString(), tz)
}

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

export const entryRoutes = new Hono<{
  Bindings: Env
  Variables: AuthVars
}>()

// All entry routes require auth
entryRoutes.use('*', authMiddleware)

/**
 * POST /api/entries
 * Create any entry type (polymorphic, Zod-validated)
 */
entryRoutes.post('/', async (c) => {
  const body = await c.req.json()
  const result = entrySchema.safeParse(body)

  if (!result.success) {
    return c.json(
      { error: 'Validation failed', details: result.error.flatten() },
      400
    )
  }

  const data = result.data
  const userId = c.get('userId')
  const db = drizzle(c.env.DB)
  const now = new Date().toISOString()
  const id = crypto.randomUUID()

  const entry = {
    id,
    userId,
    timestamp: data.timestamp,
    type: data.type,
    notes: 'notes' in data ? (data.notes ?? null) : null,
    createdAt: now,
    updatedAt: now,

    // Meal fields
    mealType: data.type === 'meal' ? data.mealType : null,
    foods: data.type === 'meal' ? (data.foods as any) : null,
    portionSize: data.type === 'meal' ? (data.portionSize ?? null) : null,

    // Symptom fields
    symptomType: data.type === 'symptom' ? data.symptomType : null,
    severity: data.type === 'symptom' ? data.severity : null,
    location: data.type === 'symptom' ? (data.location ?? null) : null,
    duration: data.type === 'symptom' ? (data.duration ?? null) : null,

    // Bowel fields
    bristolType: data.type === 'bowel' ? data.bristolType : null,
    urgency: data.type === 'bowel' ? (data.urgency ?? null) : null,
    blood: data.type === 'bowel' ? (data.blood ?? null) : null,
    mucus: data.type === 'bowel' ? (data.mucus ?? null) : null,

    // Emotion fields
    mood: data.type === 'emotion' ? data.mood : null,
    stressLevel: data.type === 'emotion' ? (data.stressLevel ?? null) : null,
    sleepQuality: data.type === 'emotion' ? (data.sleepQuality ?? null) : null,
    anxietyLevel: data.type === 'emotion' ? (data.anxietyLevel ?? null) : null,

    // Impact fields
    impactSeverity: data.type === 'impact' ? data.impactSeverity : null,
    affectedActivities:
      data.type === 'impact' ? (data.affectedActivities as any) ?? null : null,
    description: data.type === 'impact' ? (data.description ?? null) : null,
  }

  await db.insert(entries).values(entry)

  return c.json({ id, message: 'Entry created' }, 201)
})

/**
 * GET /api/entries?date=YYYY-MM-DD&type=meal|symptom|...&tz=Australia/Sydney
 * List entries filtered by date and/or type.
 * The `tz` param ensures date filtering uses the user's local day boundaries.
 */
entryRoutes.get('/', async (c) => {
  const userId = c.get('userId')
  const db = drizzle(c.env.DB)
  const date = c.req.query('date')
  const type = c.req.query('type')
  const tz = parseTz(c.req.query('tz'))

  let query = db
    .select()
    .from(entries)
    .where(eq(entries.userId, userId))
    .orderBy(desc(entries.timestamp))

  if (date) {
    // Convert the local date to UTC boundaries using the user's timezone
    const { start, end } = getUtcBoundsForLocalDate(date, tz)
    query = db
      .select()
      .from(entries)
      .where(
        and(
          eq(entries.userId, userId),
          gte(entries.timestamp, start),
          lt(entries.timestamp, end)
        )
      )
      .orderBy(desc(entries.timestamp)) as any
  }

  const results = await query

  // Filter by type in-memory if needed (simpler than dynamic SQL)
  const filtered = type
    ? results.filter((e) => e.type === type)
    : results

  return c.json(filtered)
})

/**
 * GET /api/entries/dates?month=YYYY-MM&tz=Australia/Sydney
 * Get dates with entries for a given month (for calendar picker dots).
 * Dates are returned in the user's local timezone.
 */
entryRoutes.get('/dates', async (c) => {
  const userId = c.get('userId')
  const month = c.req.query('month')
  const tz = parseTz(c.req.query('tz'))

  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return c.json({ error: 'Invalid month format. Use YYYY-MM.' }, 400)
  }

  const db = drizzle(c.env.DB)

  // Compute UTC boundaries for the first and last day of the month in the user's tz
  const [year, mon] = month.split('-').map(Number)
  const firstDay = `${month}-01`
  const lastDay = mon === 12
    ? `${year + 1}-01-01`
    : `${year}-${String(mon + 1).padStart(2, '0')}-01`
  const { start: startOfMonth } = getUtcBoundsForLocalDate(firstDay, tz)
  const { start: endOfMonth } = getUtcBoundsForLocalDate(lastDay, tz)

  const results = await db
    .select({ timestamp: entries.timestamp })
    .from(entries)
    .where(
      and(
        eq(entries.userId, userId),
        gte(entries.timestamp, startOfMonth),
        lt(entries.timestamp, endOfMonth)
      )
    )

  // Extract unique local dates by converting each UTC timestamp to the user's tz
  const dates = [...new Set(results.map((r) => utcToLocalDate(r.timestamp, tz)))]

  return c.json({ dates })
})

/**
 * PUT /api/entries/:id
 * Update an existing entry
 */
entryRoutes.put('/:id', async (c) => {
  const userId = c.get('userId')
  const entryId = c.req.param('id')
  const db = drizzle(c.env.DB)

  // Check ownership
  const [existing] = await db
    .select()
    .from(entries)
    .where(and(eq(entries.id, entryId), eq(entries.userId, userId)))
    .limit(1)

  if (!existing) {
    // Check if entry exists at all (for 403 vs 404)
    const [anyEntry] = await db
      .select()
      .from(entries)
      .where(eq(entries.id, entryId))
      .limit(1)

    if (anyEntry) {
      return c.json({ error: 'Forbidden' }, 403)
    }
    return c.json({ error: 'Entry not found' }, 404)
  }

  const body = await c.req.json()
  const result = entrySchema.safeParse({ ...body, type: existing.type })

  if (!result.success) {
    return c.json(
      { error: 'Validation failed', details: result.error.flatten() },
      400
    )
  }

  const data = result.data
  const now = new Date().toISOString()

  await db
    .update(entries)
    .set({
      timestamp: data.timestamp,
      notes: 'notes' in data ? (data.notes ?? null) : null,
      updatedAt: now,

      // Meal
      mealType: data.type === 'meal' ? data.mealType : null,
      foods: data.type === 'meal' ? (data.foods as any) : null,
      portionSize: data.type === 'meal' ? (data.portionSize ?? null) : null,

      // Symptom
      symptomType: data.type === 'symptom' ? data.symptomType : null,
      severity: data.type === 'symptom' ? data.severity : null,
      location: data.type === 'symptom' ? (data.location ?? null) : null,
      duration: data.type === 'symptom' ? (data.duration ?? null) : null,

      // Bowel
      bristolType: data.type === 'bowel' ? data.bristolType : null,
      urgency: data.type === 'bowel' ? (data.urgency ?? null) : null,
      blood: data.type === 'bowel' ? (data.blood ?? null) : null,
      mucus: data.type === 'bowel' ? (data.mucus ?? null) : null,

      // Emotion
      mood: data.type === 'emotion' ? data.mood : null,
      stressLevel: data.type === 'emotion' ? (data.stressLevel ?? null) : null,
      sleepQuality:
        data.type === 'emotion' ? (data.sleepQuality ?? null) : null,
      anxietyLevel:
        data.type === 'emotion' ? (data.anxietyLevel ?? null) : null,

      // Impact
      impactSeverity: data.type === 'impact' ? data.impactSeverity : null,
      affectedActivities:
        data.type === 'impact'
          ? (data.affectedActivities as any) ?? null
          : null,
      description: data.type === 'impact' ? (data.description ?? null) : null,
    })
    .where(eq(entries.id, entryId))

  return c.json({ message: 'Entry updated' })
})

/**
 * DELETE /api/entries/all
 * Delete all entries, correlations, and experiments for the current user
 * NOTE: Must be defined before /:id to avoid being matched as a param
 */
entryRoutes.delete('/all', async (c) => {
  const userId = c.get('userId')
  const db = drizzle(c.env.DB)

  await db.delete(entries).where(eq(entries.userId, userId))
  await db.delete(correlations).where(eq(correlations.userId, userId))
  await db.delete(experiments).where(eq(experiments.userId, userId))

  return c.json({ message: 'All data deleted' })
})

/**
 * DELETE /api/entries/:id
 * Delete an entry
 */
entryRoutes.delete('/:id', async (c) => {
  const userId = c.get('userId')
  const entryId = c.req.param('id')
  const db = drizzle(c.env.DB)

  const [existing] = await db
    .select()
    .from(entries)
    .where(and(eq(entries.id, entryId), eq(entries.userId, userId)))
    .limit(1)

  if (!existing) {
    const [anyEntry] = await db
      .select()
      .from(entries)
      .where(eq(entries.id, entryId))
      .limit(1)

    if (anyEntry) {
      return c.json({ error: 'Forbidden' }, 403)
    }
    return c.json({ error: 'Entry not found' }, 404)
  }

  await db.delete(entries).where(eq(entries.id, entryId))

  return c.json({ message: 'Entry deleted' })
})

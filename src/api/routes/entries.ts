import { Hono } from 'hono'
import { drizzle } from 'drizzle-orm/d1'
import { eq, and, gte, lt, desc } from 'drizzle-orm'
import { entries } from '../db/schema'
import { entrySchema } from '../../shared/validation'
import { authMiddleware } from '../middleware/auth'
import type { Env } from '../index'

type AuthVars = { userId: string }

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
 * GET /api/entries?date=YYYY-MM-DD&type=meal|symptom|...
 * List entries filtered by date and/or type
 */
entryRoutes.get('/', async (c) => {
  const userId = c.get('userId')
  const db = drizzle(c.env.DB)
  const date = c.req.query('date')
  const type = c.req.query('type')

  let query = db
    .select()
    .from(entries)
    .where(eq(entries.userId, userId))
    .orderBy(desc(entries.timestamp))

  if (date) {
    // Filter by date (YYYY-MM-DD) — match entries whose timestamp starts with that date
    const startOfDay = `${date}T00:00:00`
    const endOfDay = `${date}T23:59:59`
    query = db
      .select()
      .from(entries)
      .where(
        and(
          eq(entries.userId, userId),
          gte(entries.timestamp, startOfDay),
          lt(entries.timestamp, `${date}T99:99:99`) // will catch all times on that date
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
 * GET /api/entries/dates?month=YYYY-MM
 * Get dates with entries for a given month (for calendar picker dots)
 */
entryRoutes.get('/dates', async (c) => {
  const userId = c.get('userId')
  const month = c.req.query('month')

  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return c.json({ error: 'Invalid month format. Use YYYY-MM.' }, 400)
  }

  const db = drizzle(c.env.DB)
  const startOfMonth = `${month}-01T00:00:00`
  // Get end of month by going to next month
  const [year, mon] = month.split('-').map(Number)
  const nextMonth = mon === 12 ? `${year + 1}-01` : `${year}-${String(mon + 1).padStart(2, '0')}`
  const endOfMonth = `${nextMonth}-01T00:00:00`

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

  // Extract unique dates
  const dates = [...new Set(results.map((r) => r.timestamp.split('T')[0]))]

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

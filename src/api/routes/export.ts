import { Hono } from 'hono'
import { drizzle } from 'drizzle-orm/d1'
import { eq } from 'drizzle-orm'
import { entries, experiments, correlations } from '../db/schema'
import { entrySchema } from '../../shared/validation'
import { authMiddleware } from '../middleware/auth'
import type { Env } from '../index'

type AuthVars = { userId: string }

export const exportRoutes = new Hono<{
  Bindings: Env
  Variables: AuthVars
}>()

exportRoutes.use('*', authMiddleware)

/**
 * GET /api/export?format=json|csv
 * Export all user data
 */
exportRoutes.get('/', async (c) => {
  const userId = c.get('userId')
  const format = c.req.query('format') || 'json'
  const db = drizzle(c.env.DB)

  const allEntries = await db
    .select()
    .from(entries)
    .where(eq(entries.userId, userId))

  const allExperiments = await db
    .select()
    .from(experiments)
    .where(eq(experiments.userId, userId))

  const allCorrelations = await db
    .select()
    .from(correlations)
    .where(eq(correlations.userId, userId))

  if (format === 'csv') {
    const csvRows = [
      'id,type,timestamp,notes,mealType,foods,portionSize,symptomType,severity,location,duration,bristolType,urgency,blood,mucus,mood,stressLevel,sleepQuality,anxietyLevel,impactSeverity,affectedActivities,description',
    ]

    for (const entry of allEntries) {
      const row = [
        entry.id,
        entry.type,
        entry.timestamp,
        csvEscape(entry.notes),
        entry.mealType,
        entry.foods ? JSON.stringify(entry.foods) : '',
        entry.portionSize,
        entry.symptomType,
        entry.severity,
        entry.location,
        entry.duration,
        entry.bristolType,
        entry.urgency,
        entry.blood,
        entry.mucus,
        entry.mood,
        entry.stressLevel,
        entry.sleepQuality,
        entry.anxietyLevel,
        entry.impactSeverity,
        entry.affectedActivities
          ? JSON.stringify(entry.affectedActivities)
          : '',
        csvEscape(entry.description),
      ].join(',')
      csvRows.push(row)
    }

    return c.text(csvRows.join('\n'), 200, {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="gutlog-export.csv"',
    })
  }

  // JSON export
  const data = {
    exportedAt: new Date().toISOString(),
    entries: allEntries,
    experiments: allExperiments,
    correlations: allCorrelations,
  }

  return c.json(data, 200, {
    'Content-Disposition': 'attachment; filename="gutlog-export.json"',
  })
})

/**
 * POST /api/export (import endpoint — reusing the route group)
 * Import data from JSON. Validates each entry. Duplicate detection.
 */
exportRoutes.post('/', async (c) => {
  const userId = c.get('userId')
  const body = await c.req.json()
  const db = drizzle(c.env.DB)

  if (!body.entries || !Array.isArray(body.entries)) {
    return c.json({ error: 'Invalid import format. Expected { entries: [...] }' }, 400)
  }

  const results = { imported: 0, skipped: 0, errors: [] as string[] }

  // Load existing entries for duplicate detection
  const existing = await db
    .select({ timestamp: entries.timestamp, type: entries.type })
    .from(entries)
    .where(eq(entries.userId, userId))

  const existingSet = new Set(
    existing.map((e) => `${e.timestamp}|${e.type}`)
  )

  for (let i = 0; i < body.entries.length; i++) {
    const entry = body.entries[i]
    const validation = entrySchema.safeParse(entry)

    if (!validation.success) {
      results.errors.push(
        `Entry ${i}: ${validation.error.issues.map((i) => i.message).join(', ')}`
      )
      continue
    }

    const key = `${entry.timestamp}|${entry.type}`
    if (existingSet.has(key)) {
      results.skipped++
      continue
    }

    // Insert (reuse the same logic as create)
    const id = crypto.randomUUID()
    const now = new Date().toISOString()
    const data = validation.data

    await db.insert(entries).values({
      id,
      userId,
      timestamp: data.timestamp,
      type: data.type,
      notes: 'notes' in data ? (data.notes ?? null) : null,
      createdAt: now,
      updatedAt: now,
      mealType: data.type === 'meal' ? data.mealType : null,
      foods: data.type === 'meal' ? (data.foods as any) : null,
      portionSize: data.type === 'meal' ? (data.portionSize ?? null) : null,
      symptomType: data.type === 'symptom' ? data.symptomType : null,
      severity: data.type === 'symptom' ? data.severity : null,
      location: data.type === 'symptom' ? (data.location ?? null) : null,
      duration: data.type === 'symptom' ? (data.duration ?? null) : null,
      bristolType: data.type === 'bowel' ? data.bristolType : null,
      urgency: data.type === 'bowel' ? (data.urgency ?? null) : null,
      blood: data.type === 'bowel' ? (data.blood ?? null) : null,
      mucus: data.type === 'bowel' ? (data.mucus ?? null) : null,
      mood: data.type === 'emotion' ? data.mood : null,
      stressLevel: data.type === 'emotion' ? (data.stressLevel ?? null) : null,
      sleepQuality: data.type === 'emotion' ? (data.sleepQuality ?? null) : null,
      anxietyLevel: data.type === 'emotion' ? (data.anxietyLevel ?? null) : null,
      impactSeverity: data.type === 'impact' ? data.impactSeverity : null,
      affectedActivities: data.type === 'impact' ? (data.affectedActivities as any) ?? null : null,
      description: data.type === 'impact' ? (data.description ?? null) : null,
    })

    existingSet.add(key)
    results.imported++
  }

  return c.json(results)
})

function csvEscape(value: string | null | undefined): string {
  if (!value) return ''
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

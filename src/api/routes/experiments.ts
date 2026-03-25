import { Hono } from 'hono'
import { drizzle } from 'drizzle-orm/d1'
import { eq, and, gte, lt, desc } from 'drizzle-orm'
import { experiments, entries } from '../db/schema'
import {
  createExperimentSchema,
  updateExperimentSchema,
} from '../../shared/validation'
import { authMiddleware } from '../middleware/auth'
import type { Env } from '../index'

type AuthVars = { userId: string }

export const experimentRoutes = new Hono<{
  Bindings: Env
  Variables: AuthVars
}>()

experimentRoutes.use('*', authMiddleware)

/**
 * GET /api/experiments
 * List all experiments for the user
 */
experimentRoutes.get('/', async (c) => {
  const userId = c.get('userId')
  const db = drizzle(c.env.DB)

  const results = await db
    .select()
    .from(experiments)
    .where(eq(experiments.userId, userId))
    .orderBy(desc(experiments.createdAt))

  return c.json(results)
})

/**
 * GET /api/experiments/:id
 * Get a single experiment with compliance check
 */
experimentRoutes.get('/:id', async (c) => {
  const userId = c.get('userId')
  const experimentId = c.req.param('id')
  const db = drizzle(c.env.DB)

  const [experiment] = await db
    .select()
    .from(experiments)
    .where(and(eq(experiments.id, experimentId), eq(experiments.userId, userId)))
    .limit(1)

  if (!experiment) {
    return c.json({ error: 'Experiment not found' }, 404)
  }

  // Check compliance: scan meals during experiment for eliminated foods
  const violations: Array<{ entryId: string; food: string; date: string }> = []

  if (experiment.status === 'active') {
    const mealsDuringExp = await db
      .select()
      .from(entries)
      .where(
        and(
          eq(entries.userId, userId),
          eq(entries.type, 'meal'),
          gte(entries.timestamp, experiment.startDate)
        )
      )

    const eliminatedLower = (experiment.eliminatedFoods as string[]).map((f) =>
      f.toLowerCase()
    )

    for (const meal of mealsDuringExp) {
      const foods = (meal.foods as Array<{ name: string }>) || []
      for (const food of foods) {
        if (eliminatedLower.includes(food.name.toLowerCase().trim())) {
          violations.push({
            entryId: meal.id,
            food: food.name,
            date: meal.timestamp.split('T')[0],
          })
        }
      }
    }
  }

  return c.json({ ...experiment, violations })
})

/**
 * POST /api/experiments
 * Create a new experiment with baseline calculation
 */
experimentRoutes.post('/', async (c) => {
  const userId = c.get('userId')
  const body = await c.req.json()
  const result = createExperimentSchema.safeParse(body)

  if (!result.success) {
    return c.json(
      { error: 'Validation failed', details: result.error.flatten() },
      400
    )
  }

  const data = result.data
  const db = drizzle(c.env.DB)
  const now = new Date()
  const startDate = now.toISOString()
  const endDate = new Date(
    now.getTime() + data.durationDays * 24 * 60 * 60 * 1000
  ).toISOString()

  // Calculate baseline symptom rate (last 14 days before start)
  const baselineStart = new Date(
    now.getTime() - 14 * 24 * 60 * 60 * 1000
  ).toISOString()

  const recentSymptoms = await db
    .select()
    .from(entries)
    .where(
      and(
        eq(entries.userId, userId),
        eq(entries.type, 'symptom'),
        gte(entries.timestamp, baselineStart),
        lt(entries.timestamp, startDate)
      )
    )

  const baselineRate = recentSymptoms.length / 14 // symptoms per day

  const id = crypto.randomUUID()

  await db.insert(experiments).values({
    id,
    userId,
    name: data.name,
    description: data.description ?? null,
    status: 'active',
    eliminatedFoods: data.eliminatedFoods as any,
    startDate,
    endDate,
    durationDays: data.durationDays,
    baselineSymptomRate: Math.round(baselineRate * 1000) / 1000,
    currentSymptomRate: null,
    result: null,
    createdAt: startDate,
    updatedAt: startDate,
  })

  return c.json({ id, message: 'Experiment created' }, 201)
})

/**
 * PUT /api/experiments/:id
 * Update experiment status (complete, abandon) or symptom rate
 */
experimentRoutes.put('/:id', async (c) => {
  const userId = c.get('userId')
  const experimentId = c.req.param('id')
  const body = await c.req.json()
  const result = updateExperimentSchema.safeParse(body)

  if (!result.success) {
    return c.json(
      { error: 'Validation failed', details: result.error.flatten() },
      400
    )
  }

  const db = drizzle(c.env.DB)

  const [existing] = await db
    .select()
    .from(experiments)
    .where(
      and(eq(experiments.id, experimentId), eq(experiments.userId, userId))
    )
    .limit(1)

  if (!existing) {
    return c.json({ error: 'Experiment not found' }, 404)
  }

  const updates: Record<string, any> = {
    updatedAt: new Date().toISOString(),
  }

  const data = result.data

  if (data.status) updates.status = data.status
  if (data.currentSymptomRate !== undefined)
    updates.currentSymptomRate = data.currentSymptomRate

  // Auto-classify result when completing
  if (data.status === 'completed' && existing.baselineSymptomRate != null) {
    const current = data.currentSymptomRate ?? existing.currentSymptomRate ?? 0
    const baseline = existing.baselineSymptomRate

    if (baseline === 0) {
      updates.result = 'no_change'
    } else {
      const change = (baseline - current) / baseline
      if (change > 0.5) updates.result = 'significant_improvement'
      else if (change > 0.2) updates.result = 'mild_improvement'
      else if (change > -0.2) updates.result = 'no_change'
      else updates.result = 'worsened'
    }
  }

  if (data.result) updates.result = data.result

  await db
    .update(experiments)
    .set(updates)
    .where(eq(experiments.id, experimentId))

  return c.json({ message: 'Experiment updated' })
})

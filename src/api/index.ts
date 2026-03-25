import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { authRoutes } from './routes/auth'
import { entryRoutes } from './routes/entries'
import { insightRoutes } from './routes/insights'
import { experimentRoutes } from './routes/experiments'
import { foodRoutes } from './routes/foods'
import { exportRoutes } from './routes/export'
import { streakRoutes } from './routes/streak'

export type Env = {
  DB: D1Database
  JWT_SECRET: string
  RESEND_API_KEY: string
  APP_URL: string
}

const app = new Hono<{ Bindings: Env }>()

// ─── Middleware ───────────────────────────────────────────────────────
app.use('*', logger())
app.use(
  '/api/*',
  cors({
    origin: (origin) => origin, // Allow same-origin in dev
    credentials: true,
  })
)

// ─── API Routes ──────────────────────────────────────────────────────
app.route('/api/auth', authRoutes)
app.route('/api/entries', entryRoutes)
app.route('/api/insights', insightRoutes)
app.route('/api/experiments', experimentRoutes)
app.route('/api/foods', foodRoutes)
app.route('/api/export', exportRoutes)
app.route('/api/streak', streakRoutes)

// ─── SPA Fallback ────────────────────────────────────────────────────
// Serve the React SPA for all non-API routes
app.get('*', async (c) => {
  // In production, Cloudflare Pages serves static files.
  // In dev, Vite dev server handles this via proxy.
  return c.text('GutLog API is running. Frontend served by Vite in dev / Cloudflare Pages in prod.', 200)
})

export default app

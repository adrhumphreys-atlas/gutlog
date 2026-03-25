import { Context, Next } from 'hono'
import { getCookie } from 'hono/cookie'
import type { Env } from '../index'

type AuthVariables = {
  userId: string
}

/**
 * JWT auth middleware for Hono on Cloudflare Workers.
 *
 * Validates the session JWT cookie on every authenticated request.
 * JWT contains { userId, exp } — no DB lookup needed.
 *
 * Sets c.set('userId', ...) for downstream route handlers.
 */
export async function authMiddleware(
  c: Context<{ Bindings: Env; Variables: AuthVariables }>,
  next: Next
) {
  const token = getCookie(c, 'session')

  if (!token) {
    return c.json({ error: 'Not authenticated' }, 401)
  }

  try {
    const payload = await verifyJwt(token, c.env.JWT_SECRET)

    if (!payload.userId || !payload.exp) {
      return c.json({ error: 'Invalid session' }, 401)
    }

    if (Date.now() / 1000 > payload.exp) {
      return c.json({ error: 'Session expired' }, 401)
    }

    c.set('userId', payload.userId as string)
    await next()
  } catch {
    return c.json({ error: 'Invalid session' }, 401)
  }
}

// ─── JWT helpers (Web Crypto API — works in CF Workers) ──────────────

interface JwtPayload {
  userId?: string
  exp?: number
  iat?: number
  [key: string]: unknown
}

export async function signJwt(
  payload: JwtPayload,
  secret: string
): Promise<string> {
  const header = { alg: 'HS256', typ: 'JWT' }
  const now = Math.floor(Date.now() / 1000)
  const fullPayload = { ...payload, iat: now }

  const encodedHeader = base64UrlEncode(JSON.stringify(header))
  const encodedPayload = base64UrlEncode(JSON.stringify(fullPayload))
  const signingInput = `${encodedHeader}.${encodedPayload}`

  const key = await importKey(secret)
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(signingInput)
  )

  const encodedSignature = base64UrlEncode(
    String.fromCharCode(...new Uint8Array(signature))
  )

  return `${signingInput}.${encodedSignature}`
}

export async function verifyJwt(
  token: string,
  secret: string
): Promise<JwtPayload> {
  const parts = token.split('.')
  if (parts.length !== 3) throw new Error('Invalid JWT')

  const [encodedHeader, encodedPayload, encodedSignature] = parts
  const signingInput = `${encodedHeader}.${encodedPayload}`

  const key = await importKey(secret)
  const signatureBytes = Uint8Array.from(
    atob(encodedSignature.replace(/-/g, '+').replace(/_/g, '/')),
    (c) => c.charCodeAt(0)
  )

  const valid = await crypto.subtle.verify(
    'HMAC',
    key,
    signatureBytes,
    new TextEncoder().encode(signingInput)
  )

  if (!valid) throw new Error('Invalid signature')

  return JSON.parse(atob(encodedPayload.replace(/-/g, '+').replace(/_/g, '/')))
}

async function importKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  )
}

function base64UrlEncode(str: string): string {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

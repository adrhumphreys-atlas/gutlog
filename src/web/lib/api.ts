/**
 * API client — thin wrapper around fetch() for Hono backend.
 * Handles JSON parsing, error formatting, auth redirects.
 */

const BASE = '/api'

interface ApiError {
  error: string
  details?: unknown
}

export class ApiRequestError extends Error {
  status: number
  details?: unknown

  constructor(message: string, status: number, details?: unknown) {
    super(message)
    this.name = 'ApiRequestError'
    this.status = status
    this.details = details
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: 'include',
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })

  // Auth redirect
  if (res.status === 401) {
    window.location.href = '/auth/login'
    throw new ApiRequestError('Not authenticated', 401)
  }

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as ApiError
    throw new ApiRequestError(
      body.error || `Request failed (${res.status})`,
      res.status,
      body.details
    )
  }

  // Handle empty responses (204 No Content)
  if (res.status === 204) return undefined as T

  return res.json() as Promise<T>
}

// ─── Typed API methods ───────────────────────────────────────────────

export const api = {
  // Auth
  sendMagicLink: (email: string) =>
    request('/auth/send', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  logout: () => request('/auth/logout', { method: 'POST' }),

  // Entries
  getEntries: (date?: string, type?: string) => {
    const params = new URLSearchParams()
    if (date) params.set('date', date)
    if (type) params.set('type', type)
    const qs = params.toString()
    return request<any[]>(`/entries${qs ? `?${qs}` : ''}`)
  },

  createEntry: (data: unknown) =>
    request<{ id: string }>('/entries', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateEntry: (id: string, data: unknown) =>
    request(`/entries/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteEntry: (id: string) =>
    request(`/entries/${id}`, { method: 'DELETE' }),

  getEntryDates: (month: string) =>
    request<{ dates: string[] }>(`/entries/dates?month=${month}`),

  // Streak
  getStreak: () => request<{ streak: number }>('/streak'),

  // Food
  getFoodAutocomplete: (q: string) =>
    request<{ suggestions: string[] }>(`/foods/autocomplete?q=${encodeURIComponent(q)}`),

  getRecentFoods: () =>
    request<{ recent: string[] }>('/foods/recent'),

  // Insights
  getInsights: () =>
    request<{ correlations: any[]; refreshed: boolean }>('/insights'),

  // Experiments
  getExperiments: () => request<any[]>('/experiments'),

  getExperiment: (id: string) => request<any>(`/experiments/${id}`),

  createExperiment: (data: unknown) =>
    request<{ id: string }>('/experiments', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateExperiment: (id: string, data: unknown) =>
    request(`/experiments/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
}

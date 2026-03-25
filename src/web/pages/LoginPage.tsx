import { useState } from 'react'

/**
 * Login Page (/auth/login)
 * Magic link email auth — no passwords
 */
export function LoginPage() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>(
    'idle'
  )
  const [errorMsg, setErrorMsg] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatus('sending')
    setErrorMsg('')

    try {
      const res = await fetch('/api/auth/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })

      if (!res.ok) {
        const data = (await res.json()) as { error?: string }
        throw new Error(data.error || 'Failed to send')
      }

      setStatus('sent')
    } catch (err) {
      setStatus('error')
      setErrorMsg(
        err instanceof Error ? err.message : 'Failed to send. Please try again.'
      )
    }
  }

  return (
    <div className="min-h-dvh flex items-center justify-center bg-stone-50 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-green-800">🌿 GutLog</h1>
          <p className="text-stone-500 mt-2">
            Track food & symptoms. Find your triggers.
          </p>
        </div>

        {status === 'sent' ? (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-6 text-center">
            <p className="text-2xl mb-2">📬</p>
            <p className="font-semibold text-green-800">Check your email</p>
            <p className="text-sm text-green-700 mt-1">
              We sent a login link to <strong>{email}</strong>
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-stone-700 mb-1"
              >
                Email address
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-4 py-3 rounded-xl border border-stone-300 focus:border-green-400 focus:ring-2 focus:ring-green-100 outline-none transition-colors"
                aria-describedby={status === 'error' ? 'error-msg' : undefined}
              />
            </div>

            {status === 'error' && (
              <p id="error-msg" className="text-sm text-red-600" role="alert">
                {errorMsg}
              </p>
            )}

            <button
              type="submit"
              disabled={status === 'sending'}
              className="w-full py-3 bg-green-800 text-white font-semibold rounded-xl hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors min-h-[44px]"
            >
              {status === 'sending' ? 'Sending...' : 'Send magic link'}
            </button>

            <p className="text-xs text-stone-400 text-center">
              No password needed — we'll email you a login link
            </p>
          </form>
        )}
      </div>
    </div>
  )
}

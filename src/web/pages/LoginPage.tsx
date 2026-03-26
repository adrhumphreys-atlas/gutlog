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
    <div className="min-h-dvh flex items-center justify-center bg-[#fafaf9] px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-[#4a7c59]">🌿 GutLog</h1>
          <p className="text-xs text-[#767676] mt-1.5">
            Track food & symptoms. Find your triggers.
          </p>
        </div>

        {status === 'sent' ? (
          <div className="bg-[#f0f7f0] border border-[#4a7c59]/30 rounded-[10px] p-4 text-center">
            <p className="text-2xl mb-2">📬</p>
            <p className="text-[13px] font-semibold text-[#4a7c59]">Check your email</p>
            <p className="text-xs text-[#4a7c59] mt-1">
              We sent a login link to <strong>{email}</strong>
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label
                htmlFor="email"
                className="text-xs font-semibold text-[#666] block mb-1"
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
                className="w-full px-2.5 py-2.5 rounded-md border border-[#ddd] focus:border-[#4a7c59] focus:ring-2 focus:ring-[#4a7c59]/15 outline-none transition-colors text-[13px]"
                aria-describedby={status === 'error' ? 'error-msg' : undefined}
              />
            </div>

            {status === 'error' && (
              <p id="error-msg" className="text-xs text-red-600" role="alert">
                {errorMsg}
              </p>
            )}

            <button
              type="submit"
              disabled={status === 'sending'}
              className="w-full py-2.5 bg-[#4a7c59] text-white text-sm font-semibold rounded-lg hover:bg-[#3d6a4a] disabled:opacity-50 disabled:cursor-not-allowed transition-colors min-h-[44px]"
            >
              {status === 'sending' ? 'Sending...' : 'Send magic link'}
            </button>

            <p className="text-[11px] text-[#767676] text-center">
              No password needed — we'll email you a login link
            </p>
          </form>
        )}
      </div>
    </div>
  )
}

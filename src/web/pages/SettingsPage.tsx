import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useToast } from '../components/Toast'
import { api } from '../lib/api'

/**
 * Settings Page (/settings)
 * - Export data (JSON / CSV)
 * - Import data (JSON upload)
 * - Log out
 */
export function SettingsPage() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{
    imported: number
    skipped: number
    errors: string[]
  } | null>(null)
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [resetting, setResetting] = useState(false)

  const handleLogout = async () => {
    try {
      await api.logout()
      navigate('/auth/login')
    } catch {
      // Force redirect even on error
      document.cookie = 'session=; Max-Age=0; Path=/'
      navigate('/auth/login')
    }
  }

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setImporting(true)
    setImportResult(null)

    try {
      const text = await file.text()
      const data = JSON.parse(text)

      const res = await fetch('/api/export', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!res.ok) {
        const err = (await res.json()) as { error?: string }
        throw new Error(err.error || 'Import failed')
      }

      const result = (await res.json()) as {
        imported: number
        skipped: number
        errors: string[]
      }
      setImportResult(result)
      showToast(`Imported ${result.imported} entries ✓`)
    } catch (err) {
      setImportResult({
        imported: 0,
        skipped: 0,
        errors: [err instanceof Error ? err.message : 'Failed to import'],
      })
    }

    setImporting(false)
    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      <h1 className="text-xl font-bold text-stone-900 mb-6">⚙️ Settings</h1>

      <div className="space-y-4">
        {/* Export */}
        <div className="bg-white rounded-2xl border border-stone-200 p-4">
          <h2 className="font-semibold text-stone-800 mb-2">Export Data</h2>
          <p className="text-sm text-stone-500 mb-3">
            Download all your data as JSON or CSV
          </p>
          <div className="flex gap-2">
            <a
              href="/api/export?format=json"
              className="px-4 py-2.5 bg-green-800 text-white text-sm font-medium rounded-xl hover:bg-green-700 transition-colors min-h-[44px] inline-flex items-center"
            >
              📥 Export JSON
            </a>
            <a
              href="/api/export?format=csv"
              className="px-4 py-2.5 bg-stone-200 text-stone-700 text-sm font-medium rounded-xl hover:bg-stone-300 transition-colors min-h-[44px] inline-flex items-center"
            >
              📊 Export CSV
            </a>
          </div>
        </div>

        {/* Import */}
        <div className="bg-white rounded-2xl border border-stone-200 p-4">
          <h2 className="font-semibold text-stone-800 mb-2">Import Data</h2>
          <p className="text-sm text-stone-500 mb-3">
            Import entries from a GutLog JSON export file. Duplicates are
            automatically skipped.
          </p>
          <label className="inline-flex items-center px-4 py-2.5 bg-stone-200 text-stone-700 text-sm font-medium rounded-xl hover:bg-stone-300 transition-colors cursor-pointer min-h-[44px]">
            {importing ? 'Importing...' : '📤 Choose JSON file'}
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              onChange={handleImport}
              disabled={importing}
              className="sr-only"
            />
          </label>

          {importResult && (
            <div className="mt-3 p-3 bg-stone-50 rounded-xl text-sm">
              <p className="text-stone-700">
                ✅ Imported: <strong>{importResult.imported}</strong>
                {importResult.skipped > 0 && (
                  <> · Skipped (duplicates): <strong>{importResult.skipped}</strong></>
                )}
              </p>
              {importResult.errors.length > 0 && (
                <div className="mt-2">
                  <p className="text-red-600 font-medium">
                    Errors ({importResult.errors.length}):
                  </p>
                  <ul className="text-xs text-red-500 mt-1 space-y-0.5">
                    {importResult.errors.slice(0, 5).map((err, i) => (
                      <li key={i}>• {err}</li>
                    ))}
                    {importResult.errors.length > 5 && (
                      <li>...and {importResult.errors.length - 5} more</li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Timezone info */}
        <div className="bg-white rounded-2xl border border-stone-200 p-4">
          <h2 className="font-semibold text-stone-800 mb-2">Timezone</h2>
          <p className="text-sm text-stone-500">
            Your browser timezone:{' '}
            <strong>{Intl.DateTimeFormat().resolvedOptions().timeZone}</strong>
          </p>
          <p className="text-xs text-stone-400 mt-1">
            All timestamps are stored in UTC and displayed in your local time.
          </p>
        </div>

        {/* Reset Data */}
        <div className="bg-white rounded-2xl border border-red-200 p-4">
          <h2 className="font-semibold text-stone-800 mb-2">Reset Data</h2>
          <p className="text-sm text-stone-500 mb-3">
            Permanently delete all your entries, insights, and experiments.
            This cannot be undone.
          </p>
          {!showResetConfirm ? (
            <button
              onClick={() => setShowResetConfirm(true)}
              className="text-sm text-red-600 hover:text-red-700 font-medium min-h-[44px] px-4 py-2.5 hover:bg-red-50 rounded-xl transition-colors"
            >
              🗑️ Reset all data
            </button>
          ) : (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3">
              <p className="text-sm text-red-700 font-medium mb-3">
                ⚠️ Are you sure? This will delete all your data permanently.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={async () => {
                    setResetting(true)
                    try {
                      await api.resetAllData()
                      showToast('All data has been reset ✓')
                      setShowResetConfirm(false)
                    } catch {
                      showToast('Failed to reset data')
                    }
                    setResetting(false)
                  }}
                  disabled={resetting}
                  className="px-4 py-2.5 bg-red-600 text-white text-sm font-medium rounded-xl hover:bg-red-700 transition-colors min-h-[44px] disabled:opacity-50"
                >
                  {resetting ? 'Deleting...' : 'Yes, delete everything'}
                </button>
                <button
                  onClick={() => setShowResetConfirm(false)}
                  disabled={resetting}
                  className="px-4 py-2.5 bg-stone-200 text-stone-700 text-sm font-medium rounded-xl hover:bg-stone-300 transition-colors min-h-[44px]"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Account */}
        <div className="bg-white rounded-2xl border border-stone-200 p-4">
          <h2 className="font-semibold text-stone-800 mb-2">Account</h2>
          <button
            onClick={handleLogout}
            className="text-sm text-red-600 hover:text-red-700 font-medium min-h-[44px] px-4 py-2 hover:bg-red-50 rounded-xl transition-colors"
          >
            Log out
          </button>
        </div>

        {/* App info */}
        <div className="text-center pt-4">
          <p className="text-xs text-stone-400">
            🌿 GutLog v0.1.0 · Built with Cloudflare Workers + D1
          </p>
        </div>
      </div>
    </div>
  )
}

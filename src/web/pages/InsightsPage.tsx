import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, ApiRequestError } from '../lib/api'
import { InsightsSkeleton } from '../components/Skeleton'

interface Correlation {
  id: string
  triggerType: string
  triggerValue: string
  symptomType: string
  confidence: number
  relativeRisk: number
  consistencyRatio: number
  occurrences: number
  totalOpportunities: number
}

/**
 * Insights Page (/insights)
 *
 * "Pattern Spotter" — statistical correlations between foods and symptoms.
 * Shows progress ring when <14 days of data.
 * Shows correlation cards ranked by confidence when enough data exists.
 */
export function InsightsPage() {
  const navigate = useNavigate()
  const [correlations, setCorrelations] = useState<Correlation[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshed, setRefreshed] = useState(false)
  const [daysLogged, setDaysLogged] = useState(0)

  useEffect(() => {
    loadInsights()
    loadDaysLogged()
  }, [])

  const loadInsights = async () => {
    setLoading(true)
    try {
      const data = await api.getInsights()
      setCorrelations(data.correlations)
      setRefreshed(data.refreshed)
    } catch (err) {
      if (err instanceof ApiRequestError && err.status === 401) return
      console.error('Failed to load insights:', err)
    }
    setLoading(false)
  }

  const loadDaysLogged = async () => {
    try {
      // Approximate days logged by checking current month + last month
      const now = new Date()
      const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
      const lastMonth = now.getMonth() === 0
        ? `${now.getFullYear() - 1}-12`
        : `${now.getFullYear()}-${String(now.getMonth()).padStart(2, '0')}`

      const [thisData, lastData] = await Promise.all([
        api.getEntryDates(thisMonth),
        api.getEntryDates(lastMonth),
      ])

      const allDates = new Set([...thisData.dates, ...lastData.dates])
      setDaysLogged(allDates.size)
    } catch {
      // Non-critical
    }
  }

  const startExperiment = (foodName: string) => {
    // Navigate to home with experiment sheet open, pre-filling the food name
    // The experiment creation will be handled on the experiments page
    navigate(`/experiments?suggest=${encodeURIComponent(foodName)}`)
  }

  const confidenceLabel = (c: number): string => {
    if (c >= 0.7) return 'Strong'
    if (c >= 0.5) return 'Moderate'
    return 'Weak'
  }

  const confidenceColor = (c: number): string => {
    if (c >= 0.7) return 'text-red-600 bg-red-50 border-red-200'
    if (c >= 0.5) return 'text-orange-600 bg-orange-50 border-orange-200'
    return 'text-yellow-700 bg-yellow-50 border-yellow-200'
  }

  const riskBar = (confidence: number): number => {
    return Math.round(confidence * 100)
  }

  if (loading) {
    return (
      <div className="max-w-lg mx-auto px-4 py-6">
        <h1 className="text-xl font-bold text-stone-900 mb-6">
          🔍 Pattern Spotter
        </h1>
        <InsightsSkeleton />
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-stone-900">
          🔍 Pattern Spotter
        </h1>
        {refreshed && (
          <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full">
            ✓ Updated
          </span>
        )}
      </div>

      {/* Not enough data — progress ring */}
      {daysLogged < 14 && correlations.length === 0 ? (
        <div className="text-center py-16">
          <div className="inline-flex items-center justify-center w-28 h-28 rounded-full relative mb-4">
            {/* Background ring */}
            <svg className="w-28 h-28 transform -rotate-90" viewBox="0 0 100 100">
              <circle
                cx="50" cy="50" r="42"
                fill="none" stroke="#e7e5e4" strokeWidth="8"
              />
              <circle
                cx="50" cy="50" r="42"
                fill="none" stroke="#4ade80" strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={`${(daysLogged / 14) * 264} 264`}
              />
            </svg>
            <span className="absolute text-stone-600 text-sm font-semibold">
              {daysLogged}/14
            </span>
          </div>
          <p className="font-medium text-stone-700">Not enough data yet</p>
          <p className="text-sm text-stone-500 mt-1">
            Log entries for at least 14 days to see patterns.
          </p>
          <p className="text-sm text-stone-500 mt-1">
            You've logged on <strong>{daysLogged}</strong> day{daysLogged !== 1 ? 's' : ''} so far — keep going!
          </p>
        </div>
      ) : correlations.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-4xl mb-3">🎉</p>
          <p className="font-medium text-stone-700">No strong patterns found</p>
          <p className="text-sm text-stone-500 mt-1">
            Your data doesn't show any clear food-symptom correlations yet.
            Keep logging — patterns may emerge with more data.
          </p>
        </div>
      ) : (
        /* Correlation cards */
        <div className="space-y-3">
          <p className="text-sm text-stone-500 mb-4">
            Based on your logs, these foods may be linked to symptoms:
          </p>

          {correlations.map((corr) => (
            <div
              key={corr.id}
              className="bg-purple-50/50 border border-purple-200 rounded-2xl p-4"
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className="font-semibold text-purple-900 capitalize">
                    {corr.triggerValue}
                  </h3>
                  <p className="text-xs text-purple-600 mt-0.5">
                    {corr.occurrences} of {corr.totalOpportunities} times →
                    symptoms within 6h
                  </p>
                </div>
                <span
                  className={`text-xs font-medium px-2 py-1 rounded-full border ${confidenceColor(corr.confidence)}`}
                >
                  {confidenceLabel(corr.confidence)}
                </span>
              </div>

              {/* Confidence bar */}
              <div className="flex items-center gap-2 mb-3">
                <div className="flex-1 h-2 bg-purple-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-purple-500 rounded-full transition-all"
                    style={{ width: `${riskBar(corr.confidence)}%` }}
                  />
                </div>
                <span className="text-xs text-purple-600 font-medium w-10 text-right">
                  {riskBar(corr.confidence)}%
                </span>
              </div>

              {/* Risk stats */}
              <div className="flex gap-4 text-xs text-purple-700 mb-3">
                <span>
                  Risk: <strong>{corr.relativeRisk.toFixed(1)}x</strong>
                </span>
                <span>
                  Consistency:{' '}
                  <strong>{Math.round(corr.consistencyRatio * 100)}%</strong>
                </span>
              </div>

              {/* Action */}
              <button
                onClick={() => startExperiment(corr.triggerValue)}
                className="w-full py-2.5 text-sm font-medium text-purple-700 bg-purple-100 hover:bg-purple-200 rounded-xl transition-colors min-h-[44px]"
              >
                🧪 Start Elimination Experiment
              </button>
            </div>
          ))}

          <p className="text-xs text-stone-400 text-center pt-4">
            These are statistical patterns, not medical advice.
            Consult a healthcare provider for diagnosis.
          </p>
        </div>
      )}
    </div>
  )
}

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
 * Matches wireframe screens 9 (empty state) and 10 (with data).
 * Shows progress ring when <14 days of data with blurred preview.
 * Shows insight cards, trigger bar chart, and symptom trend when enough data exists.
 */
export function InsightsPage() {
  const navigate = useNavigate()
  const [correlations, setCorrelations] = useState<Correlation[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshed, setRefreshed] = useState(false)
  const [daysLogged, setDaysLogged] = useState(0)
  const [totalEntries, setTotalEntries] = useState(0)

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

      // Get total entry count for subtitle
      const allEntries = await api.getEntries()
      setTotalEntries(allEntries.length)
    } catch {
      // Non-critical
    }
  }

  const startExperiment = (foodName: string) => {
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

  // Sort correlations by confidence descending for the trigger bar chart
  const topTriggers = [...correlations]
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 6)

  if (loading) {
    return (
      <div className="max-w-lg mx-auto px-4 py-4">
        <h2 className="text-[15px] font-semibold text-[#555] mb-3">
          📊 Your Insights
        </h2>
        <InsightsSkeleton />
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-4">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-[15px] font-semibold text-[#555]">
          📊 Your Insights
        </h2>
        {refreshed && (
          <span className="text-xs text-[#4a7c59] bg-[#f0f7f0] px-2 py-1 rounded-full">
            ✓ Updated
          </span>
        )}
      </div>

      {/* Not enough data — progress ring + blurred preview (Screen 9) */}
      {daysLogged < 14 && correlations.length === 0 ? (
        <>
          <div className="text-center py-8">
            {/* Progress ring */}
            <div className="inline-flex items-center justify-center w-[120px] h-[120px] rounded-full relative mb-3">
              <svg className="w-[120px] h-[120px] transform -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50" cy="50" r="42"
                  fill="none" stroke="#e0e0e0" strokeWidth="8"
                />
                <circle
                  cx="50" cy="50" r="42"
                  fill="none" stroke="#4a7c59" strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={`${(daysLogged / 14) * 264} 264`}
                />
              </svg>
              <span className="absolute text-[#4a7c59] text-sm font-semibold">
                Day {daysLogged}
              </span>
            </div>
            <p className="text-sm text-[#666]">
              Keep logging — your first insights are brewing. ☕
            </p>
            <p className="text-xs text-[#767676] mt-1">
              We need about 2 weeks of data to spot meaningful patterns. You're on your way!
            </p>
          </div>

          {/* Blurred preview */}
          <div className="blur-[4px] opacity-40 pointer-events-none select-none">
            <div className="border border-[#e0d4f5] rounded-[10px] p-3 bg-[#faf7ff] mb-2.5">
              <div className="text-[10px] uppercase tracking-[0.5px] text-[#8b7bb8] font-semibold">
                🔍 Pattern Spotter
              </div>
              <div className="text-[13px] mt-1 leading-snug">
                Sample insight will appear here when you have enough data...
              </div>
            </div>
            <h3 className="text-[13px] font-semibold text-[#666] mb-1.5">
              Top Suspected Triggers
            </h3>
            <div className="space-y-1.5">
              <div className="flex items-center text-xs">
                <span className="w-20 text-right pr-2 text-[#666]">Food A</span>
                <div className="h-4 rounded bg-[#e89b5e]" style={{ width: '140px' }} />
                <span className="pl-1.5 text-[11px] text-[#767676]">70%</span>
              </div>
              <div className="flex items-center text-xs">
                <span className="w-20 text-right pr-2 text-[#666]">Food B</span>
                <div className="h-4 rounded bg-[#e89b5e]" style={{ width: '100px' }} />
                <span className="pl-1.5 text-[11px] text-[#767676]">50%</span>
              </div>
            </div>
          </div>
        </>
      ) : correlations.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-4xl mb-3">🎉</p>
          <p className="font-medium text-[#333]">No strong patterns found</p>
          <p className="text-sm text-[#767676] mt-1">
            Your data doesn't show any clear food-symptom correlations yet.
            Keep logging — patterns may emerge with more data.
          </p>
        </div>
      ) : (
        <>
          {/* Subtitle — entry count */}
          <p className="text-xs text-[#767676] mb-3">
            Last 30 days · {totalEntries} entries logged
          </p>

          {/* Insight cards (Screen 10) */}
          <div className="space-y-2.5">
            {correlations.slice(0, 3).map((corr, i) => (
              <div
                key={corr.id}
                className="border border-[#e0d4f5] rounded-[10px] p-3 bg-[#faf7ff]"
              >
                <div className="text-[10px] uppercase tracking-[0.5px] text-[#8b7bb8] font-semibold">
                  {i === 0 ? '🔍 Pattern Spotter' : '📈 Pattern'}
                </div>
                <div className="text-[13px] mt-1 leading-snug">
                  You report <strong>{corr.symptomType}</strong>{' '}
                  <strong>{corr.occurrences} out of {corr.totalOpportunities} times</strong>{' '}
                  within hours of eating <strong className="capitalize">{corr.triggerValue}</strong>.
                  {corr.confidence >= 0.7
                    ? ` ${corr.triggerValue.charAt(0).toUpperCase() + corr.triggerValue.slice(1)} might be a trigger.`
                    : ''}
                </div>
                <div className="text-[11px] text-[#767676] mt-1">
                  Confidence: {Math.round(corr.confidence * 100)}% ·
                  Risk: {corr.relativeRisk.toFixed(1)}x ·{' '}
                  <span className={`font-medium ${confidenceColor(corr.confidence)} px-1.5 py-0.5 rounded-full border text-[10px]`}>
                    {confidenceLabel(corr.confidence)}
                  </span>
                </div>
                {corr.confidence >= 0.5 && (
                  <button
                    onClick={() => startExperiment(corr.triggerValue)}
                    className="mt-2 px-3 py-1.5 text-[11px] font-medium text-[#4a7c59] bg-white border border-[#4a7c59] rounded-lg hover:bg-[#f0f7f0] transition-colors min-h-[44px]"
                  >
                    🔬 Start Elimination Experiment
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Top Suspected Triggers — bar chart */}
          {topTriggers.length > 0 && (
            <div className="mt-4">
              <h3 className="text-[13px] font-semibold text-[#666] mb-2">
                Top Suspected Triggers
              </h3>
              <div className="space-y-1.5">
                {topTriggers.map((corr) => {
                  const pct = Math.round(corr.confidence * 100)
                  return (
                    <div key={corr.id} className="flex items-center text-xs">
                      <span className="w-20 text-right pr-2 text-[#666] capitalize truncate">
                        {corr.triggerValue}
                      </span>
                      <div className="flex-1 h-4 bg-[#eee] rounded overflow-hidden">
                        <div
                          className="h-full bg-[#e89b5e] rounded transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="pl-1.5 text-[11px] text-[#767676] w-10 text-right">
                        {pct}%
                      </span>
                    </div>
                  )
                })}
              </div>
              <p className="text-[11px] text-[#767676] mt-1">
                % of times a symptom followed within 6 hours
              </p>
            </div>
          )}

          {/* Symptom Trend placeholder */}
          <div className="mt-4">
            <h3 className="text-[13px] font-semibold text-[#666] mb-2">
              Symptom Trend (4 weeks)
            </h3>
            <div className="border border-dashed border-[#ccc] rounded-lg p-4 text-center text-xs text-[#767676] bg-[#fcfcfc]">
              📉 Symptom frequency trend coming soon
            </div>
          </div>

          <p className="text-xs text-[#767676] text-center pt-4">
            These are statistical patterns, not medical advice.
            Consult a healthcare provider for diagnosis.
          </p>
        </>
      )}
    </div>
  )
}

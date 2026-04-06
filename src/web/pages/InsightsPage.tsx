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
  windowHours: number
}

/** Emoji + label for each symptom type */
const SYMPTOM_DISPLAY: Record<string, { emoji: string; label: string }> = {
  bloating: { emoji: '🎈', label: 'Bloating' },
  gas: { emoji: '💨', label: 'Gas' },
  nausea: { emoji: '🤢', label: 'Nausea' },
  cramps: { emoji: '🔄', label: 'Cramps' },
  pain: { emoji: '😣', label: 'Pain' },
  fatigue: { emoji: '😴', label: 'Fatigue' },
  other: { emoji: '⚠️', label: 'Symptom' },
  any: { emoji: '🩺', label: 'Symptoms' },
  abnormal_bowel: { emoji: '💩', label: 'Irregular bowel' },
}

/** Emoji + label for trigger types */
const TRIGGER_DISPLAY: Record<string, { emoji: string; label: string }> = {
  food: { emoji: '🍽️', label: 'Food trigger' },
  emotion: { emoji: '🧠', label: 'Gut-brain link' },
}

/** Human-readable trigger value (handle special emotion values) */
const formatTriggerValue = (triggerType: string, triggerValue: string): string => {
  if (triggerType === 'emotion') {
    if (triggerValue === 'high_stress') return 'High Stress / Anxiety'
    if (triggerValue === 'low_mood') return 'Low Mood'
  }
  return triggerValue
}

/**
 * Insights Page (/insights)
 *
 * Shows research-driven, per-symptom-type correlations with variable
 * time windows, bowel movement analysis, and stress/mood patterns.
 */
/** Represents one week of symptom data */
interface WeekBucket {
  label: string           // e.g. "Mar 9"
  total: number           // total symptom entries
  avgSeverity: number     // average severity (1-5)
  byType: Record<string, number> // count per symptom type
}

/** Build 4 weekly buckets ending at today, populate from symptom entries */
function buildWeekBuckets(symptomEntries: any[]): WeekBucket[] {
  const now = new Date()
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

  const buckets: WeekBucket[] = []
  for (let i = 3; i >= 0; i--) {
    const start = new Date(now)
    start.setDate(now.getDate() - (i + 1) * 7)
    start.setHours(0, 0, 0, 0)
    const end = new Date(start)
    end.setDate(start.getDate() + 7)

    const weekEntries = symptomEntries.filter((e: any) => {
      const t = new Date(e.timestamp).getTime()
      return t >= start.getTime() && t < end.getTime()
    })

    const severities = weekEntries
      .map((e: any) => e.severity)
      .filter((s: any) => typeof s === 'number')
    const avgSev = severities.length > 0
      ? severities.reduce((a: number, b: number) => a + b, 0) / severities.length
      : 0

    const byType: Record<string, number> = {}
    for (const e of weekEntries) {
      const st = e.symptomType || 'other'
      byType[st] = (byType[st] || 0) + 1
    }

    buckets.push({
      label: `${monthNames[start.getMonth()]} ${start.getDate()}`,
      total: weekEntries.length,
      avgSeverity: Math.round(avgSev * 10) / 10,
      byType,
    })
  }
  return buckets
}

/** Color palette for stacked symptom type bars — maps to CSS variable names */
const SYMPTOM_COLOR_VARS: Record<string, string> = {
  bloating: '--dot-bowel-accent',
  gas: '--dot-bowel',
  nausea: '--dot-emotion-accent',
  cramps: '--dot-symptom-accent',
  pain: '--dot-impact-accent',
  fatigue: '--dot-emotion',
  other: '--dot-note-accent',
}

/** Resolve a CSS variable to its computed value for use in inline styles */
function cssVar(name: string): string {
  return `var(${name})`
}

export function InsightsPage() {
  const navigate = useNavigate()
  const [correlations, setCorrelations] = useState<Correlation[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [refreshed, setRefreshed] = useState(false)
  const [refreshError, setRefreshError] = useState(false)
  const [daysLogged, setDaysLogged] = useState(0)
  const [totalEntries, setTotalEntries] = useState(0)
  const [weekBuckets, setWeekBuckets] = useState<WeekBucket[]>([])

  useEffect(() => {
    loadInsights()
    loadDaysLogged()
    loadSymptomTrend()
  }, [])

  const loadInsights = async () => {
    setLoading(true)
    setLoadError(false)
    try {
      const data = await api.getInsights()
      setCorrelations(data.correlations)
      setRefreshed(data.refreshed)
    } catch (err) {
      if (err instanceof ApiRequestError && err.status === 401) return
      console.error('Failed to load insights:', err)
      setLoadError(true)
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

  const handleRefresh = async () => {
    setRefreshing(true)
    setRefreshError(false)
    try {
      const data = await api.refreshInsights()
      setCorrelations(data.correlations)
      setRefreshed(true)
    } catch (err) {
      if (err instanceof ApiRequestError && err.status === 401) return
      console.error('Failed to refresh insights:', err)
      setRefreshError(true)
    }
    setRefreshing(false)
  }

  const loadSymptomTrend = async () => {
    try {
      const allEntries = await api.getEntries(undefined, 'symptom')
      setWeekBuckets(buildWeekBuckets(allEntries))
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
    // Strong (≥70%) → green: clear actionable signal
    // Moderate (50–70%) → orange: possible signal, keep logging
    // Weak (<50%) → purple: early pattern, more data needed
    if (c >= 0.7) return 'text-[var(--green-primary)] bg-[var(--green-light)] border-[var(--green-primary)]'
    if (c >= 0.5) return 'text-[var(--dot-symptom-accent)] bg-[var(--symptom-bg)] border-[var(--symptom-border)]'
    return 'text-[var(--insight-text)] bg-[var(--insight-bg)] border-[var(--insight-border)]'
  }

  // Sort correlations by confidence descending for the trigger bar chart
  const topTriggers = [...correlations]
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 6)

  if (loading) {
    return (
      <div className="max-w-lg mx-auto px-4 py-4">
        <h2 className="text-[15px] font-semibold text-[var(--text-secondary)] mb-3">
          📊 Your Insights
        </h2>
        <InsightsSkeleton />
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="max-w-lg mx-auto px-4 py-4">
        <h2 className="text-[15px] font-semibold text-[var(--text-secondary)] mb-3">
          📊 Your Insights
        </h2>
        <div className="text-center py-16 px-4">
          <p className="text-3xl mb-3">⚠️</p>
          <p className="font-medium text-[var(--text-primary)]">Couldn't load insights</p>
          <p className="text-sm text-[var(--text-muted)] mt-1">Check your connection and try again.</p>
          <button
            onClick={loadInsights}
            className="mt-4 px-4 py-2 text-sm font-medium text-[var(--green-primary)] border border-[var(--green-primary)] rounded-lg hover:bg-[var(--green-light)] transition-colors min-h-[44px]"
          >
            ↻ Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-4">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-[15px] font-semibold text-[var(--text-secondary)]">
          📊 Your Insights
        </h2>
        <div className="flex items-center gap-2">
          {refreshError && !refreshing && (
            <span className="text-xs text-[var(--danger-text)] bg-[var(--danger-bg)] px-2 py-1 rounded-full border border-[var(--danger-border)]">
              ✕ Refresh failed
            </span>
          )}
          {refreshed && !refreshing && !refreshError && (
            <span className="text-xs text-[var(--green-primary)] bg-[var(--green-light)] px-2 py-1 rounded-full">
              ✓ Updated
            </span>
          )}
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="text-xs text-[var(--green-primary)] border border-[var(--green-primary)] px-2.5 py-1 rounded-full hover:bg-[var(--green-light)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {refreshing ? '⏳ Recalculating…' : '↻ Refresh'}
          </button>
        </div>
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
                  fill="none" stroke="var(--border-timeline)" strokeWidth="8"
                />
                <circle
                  cx="50" cy="50" r="42"
                  fill="none" stroke="var(--green-primary)" strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={`${(daysLogged / 14) * 264} 264`}
                />
              </svg>
              <span className="absolute text-[var(--green-primary)] text-sm font-semibold">
                Day {daysLogged}
              </span>
            </div>
            <p className="text-sm text-[var(--text-label)]">
              Keep logging — your first insights are brewing. ☕
            </p>
            <p className="text-xs text-[var(--text-muted)] mt-1">
              We need about 2 weeks of data to spot meaningful patterns. You're on your way!
            </p>
          </div>

          {/* Blurred preview */}
          <div className="blur-[4px] opacity-40 pointer-events-none select-none">
            <div className="border border-[var(--insight-border)] rounded-[10px] p-3 bg-[var(--insight-bg)] mb-2.5">
              <div className="text-[10px] uppercase tracking-[0.5px] text-[var(--insight-text)] font-semibold">
                🔍 Pattern Spotter
              </div>
              <div className="text-[13px] mt-1 leading-snug text-[var(--text-primary)]">
                Sample insight will appear here when you have enough data...
              </div>
            </div>
            <h3 className="text-[13px] font-semibold text-[var(--text-label)] mb-1.5">
              Top Suspected Triggers
            </h3>
            <div className="space-y-1.5">
              <div className="flex items-center text-xs">
                <span className="w-20 text-right pr-2 text-[var(--text-label)]">Food A</span>
                <div className="h-4 rounded bg-[var(--dot-symptom-accent)]" style={{ width: '140px' }} />
                <span className="pl-1.5 text-[11px] text-[var(--text-muted)]">70%</span>
              </div>
              <div className="flex items-center text-xs">
                <span className="w-20 text-right pr-2 text-[var(--text-label)]">Food B</span>
                <div className="h-4 rounded bg-[var(--dot-symptom-accent)]" style={{ width: '100px' }} />
                <span className="pl-1.5 text-[11px] text-[var(--text-muted)]">50%</span>
              </div>
            </div>
          </div>
        </>
      ) : correlations.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-4xl mb-3">🎉</p>
          <p className="font-medium text-[var(--text-primary)]">No strong patterns found</p>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Your data doesn't show clear correlations between foods, stress, or mood
            and your symptoms yet. Keep logging — patterns may emerge with more data.
          </p>
        </div>
      ) : (
        <>
          {/* Subtitle — entry count */}
          <p className="text-xs text-[var(--text-muted)] mb-3">
            Last 30 days · {totalEntries} entries logged
          </p>

          {/* Insight cards — per-symptom with research-based windows */}
          <div className="space-y-2.5">
            {correlations.slice(0, 5).map((corr, i) => {
              const symptom = SYMPTOM_DISPLAY[corr.symptomType] ?? SYMPTOM_DISPLAY.other
              const trigger = TRIGGER_DISPLAY[corr.triggerType] ?? TRIGGER_DISPLAY.food
              const triggerLabel = formatTriggerValue(corr.triggerType, corr.triggerValue)
              const isFoodTrigger = corr.triggerType === 'food'
              const isEmotionTrigger = corr.triggerType === 'emotion'

              return (
                <div
                  key={corr.id}
                  className="border border-[var(--insight-border)] rounded-[10px] p-3 bg-[var(--insight-bg)]"
                >
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] uppercase tracking-[0.5px] text-[var(--insight-text)] font-semibold">
                      {i === 0 ? '🔍 Top Pattern' : `${trigger.emoji} ${trigger.label}`}
                    </span>
                    <span className={`ml-auto font-medium ${confidenceColor(corr.confidence)} px-1.5 py-0.5 rounded-full border text-[10px]`}>
                      {confidenceLabel(corr.confidence)}
                    </span>
                  </div>
                  <div className="text-[13px] mt-1.5 leading-snug">
                    {isFoodTrigger && (
                      <>
                        {symptom.emoji} You report <strong>{symptom.label.toLowerCase()}</strong>{' '}
                        <strong>{corr.occurrences} out of {corr.totalOpportunities} times</strong>{' '}
                        within {corr.windowHours}hrs of eating{' '}
                        <strong className="capitalize">{triggerLabel}</strong>.
                        {corr.confidence >= 0.7
                          ? ` ${triggerLabel.charAt(0).toUpperCase() + triggerLabel.slice(1)} looks like a strong trigger.`
                          : ''}
                      </>
                    )}
                    {isEmotionTrigger && (
                      <>
                        🧠 When you log <strong>{triggerLabel.toLowerCase()}</strong>,{' '}
                        symptoms follow within {corr.windowHours}hrs{' '}
                        <strong>{corr.occurrences} out of {corr.totalOpportunities} times</strong>.
                        {corr.confidence >= 0.7
                          ? ' Your gut-brain connection appears significant.'
                          : ' The gut-brain axis may play a role.'}
                      </>
                    )}
                  </div>
                  <div className="text-[11px] text-[var(--text-muted)] mt-1.5 flex items-center gap-1 flex-wrap">
                    <span>Confidence: {Math.round(corr.confidence * 100)}%</span>
                    <span>·</span>
                    <span>Risk: {corr.relativeRisk.toFixed(1)}x</span>
                    <span>·</span>
                    <span>Window: {corr.windowHours}hrs</span>
                    <span>·</span>
                    <span>{corr.totalOpportunities} occasions</span>
                  </div>
                  {corr.totalOpportunities < 8 && (
                    <p className="text-[11px] text-[var(--text-hint)] mt-1">
                      ⚠️ Low data — based on {corr.totalOpportunities} occasions. Log more to improve reliability.
                    </p>
                  )}
                  {isFoodTrigger && corr.confidence >= 0.5 && (
                    <button
                      onClick={() => startExperiment(corr.triggerValue)}
                      className="mt-2 px-3 py-1.5 text-[11px] font-medium text-[var(--green-primary)] bg-[var(--bg-card)] border border-[var(--green-primary)] rounded-lg hover:bg-[var(--green-light)] transition-colors min-h-[44px]"
                    >
                      🔬 Start Elimination Experiment
                    </button>
                  )}
                </div>
              )
            })}
          </div>

          {/* Top Suspected Triggers — bar chart */}
          {topTriggers.length > 0 && (
            <div className="mt-4">
              <h3 className="text-[13px] font-semibold text-[var(--text-label)] mb-2">
                Top Suspected Triggers
              </h3>
              <div className="space-y-1.5">
                {topTriggers.map((corr) => {
                  const pct = Math.round(corr.confidence * 100)
                  const symptom = SYMPTOM_DISPLAY[corr.symptomType] ?? SYMPTOM_DISPLAY.other
                  const label = corr.triggerType === 'emotion'
                    ? formatTriggerValue(corr.triggerType, corr.triggerValue)
                    : corr.triggerValue
                  return (
                    <div key={corr.id} className="flex items-center text-xs">
                      <span className="w-24 text-right pr-2 text-[var(--text-label)] capitalize truncate" title={`${label} → ${symptom.label}`}>
                        {corr.totalOpportunities < 8 ? '⚠️' : symptom.emoji} {label}
                      </span>
                      <div className="flex-1 h-4 bg-[var(--bg-muted)] rounded overflow-hidden">
                        <div
                          className="h-full bg-[var(--dot-symptom-accent)] rounded transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="pl-1.5 text-[11px] text-[var(--text-muted)] w-10 text-right">
                        {pct}%
                      </span>
                    </div>
                  )
                })}
              </div>
              <p className="text-[11px] text-[var(--text-muted)] mt-1">
                Confidence score — our weighted measure of frequency, consistency, and relative risk. ⚠️ = fewer than 8 occasions.
              </p>
            </div>
          )}

          {/* Symptom Trend — stacked bar chart */}
          <div className="mt-4 border border-[var(--insight-border)] rounded-[10px] bg-[var(--insight-bg)] p-3">
            <div className="text-[10px] uppercase tracking-[0.5px] text-[var(--insight-text)] font-semibold mb-2">
              📉 Symptom Trend — 4 weeks
            </div>
            {weekBuckets.length > 0 && weekBuckets.some(b => b.total > 0) ? (() => {
              const maxTotal = Math.max(...weekBuckets.map(b => b.total), 1)
              // Collect all symptom types across all weeks for legend
              const allTypes = Array.from(
                new Set(weekBuckets.flatMap(b => Object.keys(b.byType)))
              ).sort()

              return (
                <>
                  {/* Bar chart */}
                  <div className="flex items-end gap-3 h-[100px] px-1">
                    {weekBuckets.map((bucket, idx) => {
                      const barHeight = maxTotal > 0 ? (bucket.total / maxTotal) * 100 : 0
                      // Build stacked segments
                      const types = Object.entries(bucket.byType).sort(([a], [b]) => a.localeCompare(b))
                      return (
                        <div key={idx} className="flex-1 flex flex-col items-center justify-end h-full">
                          {bucket.total > 0 && (
                            <div className="text-[10px] text-[var(--text-secondary)] mb-1 font-semibold">
                              {bucket.total}
                            </div>
                          )}
                          <div
                            className="w-full rounded-t-md overflow-hidden flex flex-col-reverse"
                            style={{ height: `${Math.max(barHeight, bucket.total > 0 ? 8 : 2)}%` }}
                          >
                            {types.map(([type, count]) => {
                              const segmentPct = bucket.total > 0 ? (count / bucket.total) * 100 : 0
                              const color = cssVar(SYMPTOM_COLOR_VARS[type] ?? SYMPTOM_COLOR_VARS.other)
                              return (
                                <div
                                  key={type}
                                  style={{ height: `${segmentPct}%`, backgroundColor: color }}
                                  className="w-full min-h-[3px]"
                                  title={`${(SYMPTOM_DISPLAY[type] ?? SYMPTOM_DISPLAY.other).label}: ${count}`}
                                />
                              )
                            })}
                          </div>
                          {bucket.total === 0 && (
                            <div className="w-full h-[3px] rounded bg-[var(--insight-border)]" />
                          )}
                        </div>
                      )
                    })}
                  </div>

                  {/* Week labels + severity */}
                  <div className="flex gap-3 mt-1.5 px-1">
                    {weekBuckets.map((bucket, idx) => (
                      <div key={idx} className="flex-1 text-center">
                        <div className="text-[10px] text-[var(--text-label)] font-medium">{bucket.label}</div>
                        {bucket.avgSeverity > 0 && (
                          <div className="text-[9px] text-[var(--insight-text)]">
                            sev {bucket.avgSeverity}/5
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Legend */}
                  {allTypes.length > 0 && (
                    <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2.5 pt-2 border-t border-[var(--insight-border)]">
                      {allTypes.map(type => {
                        const display = SYMPTOM_DISPLAY[type] ?? SYMPTOM_DISPLAY.other
                        const color = cssVar(SYMPTOM_COLOR_VARS[type] ?? SYMPTOM_COLOR_VARS.other)
                        return (
                          <div key={type} className="flex items-center gap-1 text-[10px] text-[var(--text-label)]">
                            <span
                              className="inline-block w-2.5 h-2.5 rounded-sm"
                              style={{ backgroundColor: color }}
                            />
                            {display.emoji} {display.label}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </>
              )
            })() : (
              <div className="text-center py-4 text-xs text-[var(--insight-text)]">
                No symptom entries in the last 4 weeks — log symptoms to see trends here
              </div>
            )}
          </div>

          <p className="text-xs text-[var(--text-muted)] text-center pt-4">
            These are statistical patterns, not medical advice.
            Consult a healthcare provider for diagnosis.
          </p>

          {/* Methodology section */}
          <details className="mt-6 border border-[var(--border-default)] rounded-[10px] bg-[var(--bg-card)]">
            <summary className="px-3 py-2.5 text-[12px] font-semibold text-[var(--text-label)] cursor-pointer select-none">
              📐 How we calculate insights
            </summary>
            <div className="px-3 pb-3 text-[12px] text-[var(--text-secondary)] leading-relaxed space-y-3">
              <div>
                <h4 className="font-semibold text-[var(--text-primary)] mb-0.5">Research-based time windows</h4>
                <p>
                  Different symptoms have different onset times after eating. We use time windows informed
                  by gastroenterology research rather than a single fixed period:
                </p>
                <ul className="mt-1 ml-4 list-disc space-y-0.5 text-[11px] text-[var(--text-label)]">
                  <li><strong>Nausea</strong> — 3 hrs (fast gastric/vagal response)</li>
                  <li><strong>Bloating &amp; Gas</strong> — 4 hrs (colonic fermentation onset)</li>
                  <li><strong>Cramps &amp; Pain</strong> — 6 hrs (small intestine transit)</li>
                  <li><strong>Fatigue</strong> — 8 hrs (systemic inflammatory response)</li>
                  <li><strong>Bowel changes</strong> — 24 hrs (full GI transit time)</li>
                  <li><strong>Stress/Mood</strong> — 24 hrs (gut-brain axis interaction)</li>
                </ul>
              </div>

              <div>
                <h4 className="font-semibold text-[var(--text-primary)] mb-0.5">Per-symptom analysis</h4>
                <p>
                  We analyze each symptom type separately — for example, "dairy → bloating" is tracked
                  independently from "dairy → cramps." This avoids diluting strong signals by lumping
                  unrelated symptoms together.
                </p>
              </div>

              <div>
                <h4 className="font-semibold text-[var(--text-primary)] mb-0.5">Relative risk</h4>
                <p>
                  For each food, we compare how often a symptom follows eating that food vs. how often it
                  follows meals <em>without</em> that food. A relative risk of 2.0× means the symptom is
                  twice as likely after eating that food.
                </p>
              </div>

              <div>
                <h4 className="font-semibold text-[var(--text-primary)] mb-0.5">Confidence score</h4>
                <p>
                  The confidence percentage is our own weighted score combining three factors — the weights below are design choices, not research-validated values:
                </p>
                <ul className="mt-1 ml-4 list-disc space-y-0.5 text-[11px] text-[var(--text-label)]">
                  <li><strong>Relative risk</strong> (40%) — how much more likely the symptom is after this food</li>
                  <li><strong>Sample size</strong> (30%) — how many times you've eaten the food (saturates at 15)</li>
                  <li><strong>Consistency</strong> (30%) — how reliably the symptom follows</li>
                </ul>
                <p className="mt-1">
                  A food needs at least 4 logged occasions before it's analyzed, and only correlations above 30% confidence are shown. Patterns with fewer than 8 occasions are flagged with ⚠️ — the score is dampened and reliability improves significantly with more data.
                </p>
              </div>

              <div>
                <h4 className="font-semibold text-[var(--text-primary)] mb-0.5">What we analyze</h4>
                <ul className="mt-1 ml-4 list-disc space-y-0.5 text-[11px] text-[var(--text-label)]">
                  <li><strong>Food → specific symptoms</strong> — each symptom type with its own time window</li>
                  <li><strong>Food → irregular bowel</strong> — Bristol stool types 1-2 (hard) or 6-7 (loose) within 24 hrs</li>
                  <li><strong>Stress &amp; mood → symptoms</strong> — whether high stress/anxiety or low mood precede symptom flares</li>
                </ul>
              </div>
            </div>
          </details>
        </>
      )}
    </div>
  )
}

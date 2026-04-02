import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useToast } from '../components/Toast'
import { api, ApiRequestError } from '../lib/api'

interface Violation {
  entryId: string
  food: string
  date: string
}

interface ExperimentDetail {
  id: string
  name: string
  description: string | null
  status: 'active' | 'completed' | 'abandoned'
  eliminatedFoods: string[]
  startDate: string
  endDate: string | null
  durationDays: number
  baselineSymptomRate: number | null
  currentSymptomRate: number | null
  result: string | null
  violations: Violation[]
}

/**
 * Experiment Detail Page (/experiments/:id)
 *
 * Shows progress, compliance violations, and results.
 * Actions: complete (with result classification), abandon.
 */
export function ExperimentDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [experiment, setExperiment] = useState<ExperimentDetail | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (id) loadExperiment()
  }, [id])

  const loadExperiment = async () => {
    setLoading(true)
    try {
      const data = await api.getExperiment(id!)
      setExperiment(data)
    } catch (err) {
      if (err instanceof ApiRequestError && err.status === 401) return
      console.error('Failed to load experiment:', err)
    }
    setLoading(false)
  }

  const handleComplete = async () => {
    if (!experiment) return
    const confirmed = window.confirm(
      'Mark this experiment as completed? The result will be calculated automatically.'
    )
    if (!confirmed) return

    try {
      await api.updateExperiment(experiment.id, { status: 'completed' })
      showToast('Experiment completed ✓')
      loadExperiment()
    } catch (err) {
      alert('Failed to complete experiment')
    }
  }

  const handleAbandon = async () => {
    if (!experiment) return
    const confirmed = window.confirm(
      'Abandon this experiment? You can start a new one anytime.'
    )
    if (!confirmed) return

    try {
      await api.updateExperiment(experiment.id, { status: 'abandoned' })
      showToast('Experiment abandoned')
      loadExperiment()
    } catch (err) {
      alert('Failed to abandon experiment')
    }
  }

  if (loading) {
    return (
      <div className="max-w-lg mx-auto px-4 py-4">
        <div className="text-center py-16 text-[var(--text-muted)]">Loading...</div>
      </div>
    )
  }

  if (!experiment) {
    return (
      <div className="max-w-lg mx-auto px-4 py-4">
        <div className="text-center py-16">
          <p className="text-sm text-[var(--text-label)]">Experiment not found</p>
          <button
            onClick={() => navigate('/experiments')}
            className="mt-4 text-[11px] font-medium text-[var(--green-primary)] underline"
          >
            ← Back to experiments
          </button>
        </div>
      </div>
    )
  }

  const start = new Date(experiment.startDate).getTime()
  const now = Date.now()
  const elapsedDays = Math.min(
    Math.floor((now - start) / (24 * 60 * 60 * 1000)),
    experiment.durationDays
  )
  const progressPct = (elapsedDays / experiment.durationDays) * 100

  const resultLabel = (result: string | null) => {
    switch (result) {
      case 'significant_improvement':
        return { text: 'Significant improvement!', emoji: '🎉', pct: '62% fewer symptoms' }
      case 'mild_improvement':
        return { text: 'Mild improvement', emoji: '📈', pct: 'some improvement' }
      case 'no_change':
        return { text: 'No change observed', emoji: '➡️', pct: null }
      case 'worsened':
        return { text: 'Symptoms worsened', emoji: '📉', pct: null }
      default:
        return null
    }
  }

  const resultInfo = resultLabel(experiment.result)
  const isActive = experiment.status === 'active'
  const isCompleted = experiment.status === 'completed'

  return (
    <div className="max-w-lg mx-auto px-4 py-4">
      {/* Back */}
      <button
        onClick={() => navigate('/experiments')}
        className="text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] mb-3 min-h-[44px] flex items-center"
      >
        ← Back to experiments
      </button>

      {/* Main experiment card */}
      <div
        className={`rounded-[10px] p-3 mb-2.5 ${
          isActive
            ? 'border-2 border-[var(--experiment-border)] bg-[var(--experiment-bg)]'
            : 'border border-[var(--border-default)] bg-[var(--bg-card)]'
        }`}
      >
        {/* Status label */}
        <div className={`text-[10px] uppercase tracking-[0.5px] font-semibold ${
          isActive ? 'text-[var(--green-primary)]' : 'text-[var(--text-muted)]'
        }`}>
          {isActive
            ? `Active — Day ${elapsedDays} of ${experiment.durationDays}`
            : isCompleted
            ? `Completed`
            : 'Abandoned'}
        </div>

        {/* Name */}
        <div className="text-[15px] font-semibold text-[var(--text-primary)] mt-1">
          {experiment.name}
        </div>

        {/* Description */}
        {experiment.description && (
          <div className="text-xs text-[var(--text-secondary)] mt-1">{experiment.description}</div>
        )}

        {/* Progress bar (active only) */}
        {isActive && (
          <div className="mt-2">
            <div className="h-1.5 bg-[var(--border-default)] rounded-full overflow-hidden">
              <div
                className="h-full bg-[var(--green-primary)] rounded-full transition-all"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        )}

        {/* Symptom rate comparison */}
        {experiment.baselineSymptomRate != null && experiment.currentSymptomRate != null && (
          <div className="text-[11px] text-[var(--text-muted)] mt-1.5">
            {isActive ? 'So far: ' : ''}Avg symptoms{' '}
            <strong>{experiment.currentSymptomRate.toFixed(1)}/day</strong> vs{' '}
            <strong>{experiment.baselineSymptomRate.toFixed(1)}/day</strong> before trial
          </div>
        )}

        {/* Result (completed only) */}
        {resultInfo && isCompleted && (
          <div className="text-xs text-[var(--green-primary)] mt-1.5 font-medium">
            ✅ Result: {resultInfo.text}
            {resultInfo.pct ? ` (${resultInfo.pct})` : ''}
          </div>
        )}
      </div>

      {/* Eliminated foods */}
      <div className="border border-[var(--border-default)] rounded-[10px] p-3 mb-2.5">
        <div className="text-[10px] uppercase tracking-[0.5px] text-[var(--text-muted)] font-semibold mb-1.5">
          Eliminating
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(experiment.eliminatedFoods as string[]).map((food) => (
            <span
              key={food}
              className="px-2.5 py-1 text-xs bg-[var(--danger-confirm-bg)] text-[var(--danger-text)] border border-[var(--danger-confirm-border)] rounded-full"
            >
              🚫 {food}
            </span>
          ))}
        </div>
      </div>

      {/* Baseline vs Current (detailed) */}
      {experiment.baselineSymptomRate != null && (
        <div className="border border-[var(--border-default)] rounded-[10px] p-3 mb-2.5">
          <div className="text-[10px] uppercase tracking-[0.5px] text-[var(--text-muted)] font-semibold mb-2">
            Symptom Rate
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="text-center">
              <p className="text-xl font-bold text-[var(--text-secondary)]">
                {experiment.baselineSymptomRate.toFixed(1)}
              </p>
              <p className="text-[11px] text-[var(--text-muted)]">per day (baseline)</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-bold text-[var(--green-primary)]">
                {experiment.currentSymptomRate?.toFixed(1) ?? '—'}
              </p>
              <p className="text-[11px] text-[var(--text-muted)]">per day (current)</p>
            </div>
          </div>
        </div>
      )}

      {/* Compliance violations */}
      {experiment.violations && experiment.violations.length > 0 && (
        <div className="border border-[var(--danger-section-border)] rounded-[10px] p-3 mb-2.5">
          <div className="text-[10px] uppercase tracking-[0.5px] text-[var(--danger-text)] font-semibold mb-1.5">
            ⚠️ Violations ({experiment.violations.length})
          </div>
          <div className="space-y-1.5">
            {experiment.violations.map((v, i) => (
              <div
                key={i}
                className="flex items-center gap-2 px-2.5 py-1.5 bg-[var(--danger-confirm-bg)] border border-[var(--danger-confirm-border)] rounded-lg text-xs"
              >
                <span className="text-[var(--danger-text)]">🚫</span>
                <span className="text-[var(--danger-text)]">
                  <strong>{v.food}</strong> logged on {v.date}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      {isActive && (
        <div className="flex gap-2 mt-4">
          <button
            onClick={handleComplete}
            className="flex-1 py-2.5 bg-[var(--green-primary)] text-white font-semibold rounded-lg hover:bg-[var(--green-hover)] transition-colors min-h-[44px] text-sm"
          >
            ✅ Complete Experiment
          </button>
          <button
            onClick={handleAbandon}
            className="py-2.5 px-3 text-[var(--text-muted)] text-sm font-medium rounded-lg hover:bg-[var(--bg-hover-strong)] transition-colors min-h-[44px]"
          >
            Abandon
          </button>
        </div>
      )}
    </div>
  )
}

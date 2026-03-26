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
        <div className="text-center py-16 text-[#767676]">Loading...</div>
      </div>
    )
  }

  if (!experiment) {
    return (
      <div className="max-w-lg mx-auto px-4 py-4">
        <div className="text-center py-16">
          <p className="text-sm text-[#666]">Experiment not found</p>
          <button
            onClick={() => navigate('/experiments')}
            className="mt-4 text-[11px] font-medium text-[#4a7c59] underline"
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
        className="text-xs text-[#767676] hover:text-[#555] mb-3 min-h-[44px] flex items-center"
      >
        ← Back to experiments
      </button>

      {/* Main experiment card */}
      <div
        className={`rounded-[10px] p-3 mb-2.5 ${
          isActive
            ? 'border-2 border-[#4a7c59] bg-[#f0f7f0]'
            : 'border border-[#ddd] bg-white'
        }`}
      >
        {/* Status label */}
        <div className={`text-[10px] uppercase tracking-[0.5px] font-semibold ${
          isActive ? 'text-[#4a7c59]' : 'text-[#767676]'
        }`}>
          {isActive
            ? `Active — Day ${elapsedDays} of ${experiment.durationDays}`
            : isCompleted
            ? `Completed`
            : 'Abandoned'}
        </div>

        {/* Name */}
        <div className="text-[15px] font-semibold text-[#333] mt-1">
          {experiment.name}
        </div>

        {/* Description */}
        {experiment.description && (
          <div className="text-xs text-[#555] mt-1">{experiment.description}</div>
        )}

        {/* Progress bar (active only) */}
        {isActive && (
          <div className="mt-2">
            <div className="h-1.5 bg-[#ddd] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#4a7c59] rounded-full transition-all"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        )}

        {/* Symptom rate comparison */}
        {experiment.baselineSymptomRate != null && experiment.currentSymptomRate != null && (
          <div className="text-[11px] text-[#767676] mt-1.5">
            {isActive ? 'So far: ' : ''}Avg symptoms{' '}
            <strong>{experiment.currentSymptomRate.toFixed(1)}/day</strong> vs{' '}
            <strong>{experiment.baselineSymptomRate.toFixed(1)}/day</strong> before trial
          </div>
        )}

        {/* Result (completed only) */}
        {resultInfo && isCompleted && (
          <div className="text-xs text-[#4a7c59] mt-1.5 font-medium">
            ✅ Result: {resultInfo.text}
            {resultInfo.pct ? ` (${resultInfo.pct})` : ''}
          </div>
        )}
      </div>

      {/* Eliminated foods */}
      <div className="border border-[#ddd] rounded-[10px] p-3 mb-2.5">
        <div className="text-[10px] uppercase tracking-[0.5px] text-[#767676] font-semibold mb-1.5">
          Eliminating
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(experiment.eliminatedFoods as string[]).map((food) => (
            <span
              key={food}
              className="px-2.5 py-1 text-xs bg-red-50 text-red-700 border border-red-200 rounded-full"
            >
              🚫 {food}
            </span>
          ))}
        </div>
      </div>

      {/* Baseline vs Current (detailed) */}
      {experiment.baselineSymptomRate != null && (
        <div className="border border-[#ddd] rounded-[10px] p-3 mb-2.5">
          <div className="text-[10px] uppercase tracking-[0.5px] text-[#767676] font-semibold mb-2">
            Symptom Rate
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="text-center">
              <p className="text-xl font-bold text-[#555]">
                {experiment.baselineSymptomRate.toFixed(1)}
              </p>
              <p className="text-[11px] text-[#767676]">per day (baseline)</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-bold text-[#4a7c59]">
                {experiment.currentSymptomRate?.toFixed(1) ?? '—'}
              </p>
              <p className="text-[11px] text-[#767676]">per day (current)</p>
            </div>
          </div>
        </div>
      )}

      {/* Compliance violations */}
      {experiment.violations && experiment.violations.length > 0 && (
        <div className="border border-[#ddd] rounded-[10px] p-3 mb-2.5">
          <div className="text-[10px] uppercase tracking-[0.5px] text-red-600 font-semibold mb-1.5">
            ⚠️ Violations ({experiment.violations.length})
          </div>
          <div className="space-y-1.5">
            {experiment.violations.map((v, i) => (
              <div
                key={i}
                className="flex items-center gap-2 px-2.5 py-1.5 bg-red-50 border border-red-200 rounded-lg text-xs"
              >
                <span className="text-red-500">🚫</span>
                <span className="text-red-700">
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
            className="flex-1 py-2.5 bg-[#4a7c59] text-white font-semibold rounded-lg hover:bg-[#3d6a4a] transition-colors min-h-[44px] text-sm"
          >
            ✅ Complete Experiment
          </button>
          <button
            onClick={handleAbandon}
            className="py-2.5 px-3 text-[#767676] text-sm font-medium rounded-lg hover:bg-[#f5f5f5] transition-colors min-h-[44px]"
          >
            Abandon
          </button>
        </div>
      )}
    </div>
  )
}

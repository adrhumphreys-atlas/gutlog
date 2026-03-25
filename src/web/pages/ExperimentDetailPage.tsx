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
      <div className="max-w-lg mx-auto px-4 py-6">
        <div className="text-center py-16 text-stone-400">Loading...</div>
      </div>
    )
  }

  if (!experiment) {
    return (
      <div className="max-w-lg mx-auto px-4 py-6">
        <div className="text-center py-16">
          <p className="font-medium text-stone-700">Experiment not found</p>
          <button
            onClick={() => navigate('/experiments')}
            className="mt-4 text-sm text-green-700 underline"
          >
            Back to experiments
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
        return { text: 'Significant improvement!', emoji: '🎉', color: 'text-green-700 bg-green-50' }
      case 'mild_improvement':
        return { text: 'Mild improvement', emoji: '📈', color: 'text-green-600 bg-green-50' }
      case 'no_change':
        return { text: 'No change observed', emoji: '➡️', color: 'text-stone-600 bg-stone-50' }
      case 'worsened':
        return { text: 'Symptoms worsened', emoji: '📉', color: 'text-red-600 bg-red-50' }
      default:
        return null
    }
  }

  const resultInfo = resultLabel(experiment.result)

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      {/* Back */}
      <button
        onClick={() => navigate('/experiments')}
        className="text-sm text-stone-500 hover:text-stone-700 mb-4 min-h-[44px] flex items-center"
      >
        ← Back to experiments
      </button>

      {/* Header */}
      <h1 className="text-xl font-bold text-stone-900 mb-1">
        {experiment.name}
      </h1>
      {experiment.description && (
        <p className="text-sm text-stone-500 mb-4">{experiment.description}</p>
      )}

      {/* Status badge */}
      <div className="flex items-center gap-2 mb-6">
        <span
          className={`px-3 py-1 text-xs font-medium rounded-full ${
            experiment.status === 'active'
              ? 'bg-green-100 text-green-800'
              : experiment.status === 'completed'
              ? 'bg-blue-100 text-blue-800'
              : 'bg-stone-100 text-stone-600'
          }`}
        >
          {experiment.status.charAt(0).toUpperCase() + experiment.status.slice(1)}
        </span>
        <span className="text-xs text-stone-400">
          Started {new Date(experiment.startDate).toLocaleDateString()}
        </span>
      </div>

      {/* Eliminated foods */}
      <div className="mb-6">
        <h2 className="text-sm font-semibold text-stone-700 mb-2">
          Eliminating
        </h2>
        <div className="flex flex-wrap gap-2">
          {(experiment.eliminatedFoods as string[]).map((food) => (
            <span
              key={food}
              className="px-3 py-1.5 text-sm bg-red-50 text-red-700 border border-red-200 rounded-full"
            >
              🚫 {food}
            </span>
          ))}
        </div>
      </div>

      {/* Progress */}
      {experiment.status === 'active' && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-stone-700 mb-2">
            Progress
          </h2>
          <div className="flex items-center gap-3">
            <div className="flex-1 h-3 bg-stone-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-400 rounded-full transition-all"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <span className="text-sm font-medium text-stone-600">
              Day {elapsedDays}/{experiment.durationDays}
            </span>
          </div>
        </div>
      )}

      {/* Baseline vs Current */}
      {experiment.baselineSymptomRate != null && (
        <div className="mb-6 bg-stone-50 rounded-2xl p-4">
          <h2 className="text-sm font-semibold text-stone-700 mb-3">
            Symptom Rate
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-stone-700">
                {experiment.baselineSymptomRate.toFixed(1)}
              </p>
              <p className="text-xs text-stone-500">per day (baseline)</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-green-700">
                {experiment.currentSymptomRate?.toFixed(1) ?? '—'}
              </p>
              <p className="text-xs text-stone-500">per day (current)</p>
            </div>
          </div>
        </div>
      )}

      {/* Result (if completed) */}
      {resultInfo && (
        <div className={`mb-6 rounded-2xl p-4 ${resultInfo.color}`}>
          <p className="text-lg font-semibold">
            {resultInfo.emoji} {resultInfo.text}
          </p>
        </div>
      )}

      {/* Compliance violations */}
      {experiment.violations && experiment.violations.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-red-600 mb-2">
            ⚠️ Compliance Violations ({experiment.violations.length})
          </h2>
          <div className="space-y-2">
            {experiment.violations.map((v, i) => (
              <div
                key={i}
                className="flex items-center gap-3 px-3 py-2 bg-red-50 border border-red-200 rounded-xl text-sm"
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
      {experiment.status === 'active' && (
        <div className="flex gap-3 pt-4">
          <button
            onClick={handleComplete}
            className="flex-1 py-3 bg-green-800 text-white font-semibold rounded-xl hover:bg-green-700 transition-colors min-h-[44px]"
          >
            ✅ Complete
          </button>
          <button
            onClick={handleAbandon}
            className="py-3 px-4 text-stone-500 font-medium rounded-xl hover:bg-stone-100 transition-colors min-h-[44px]"
          >
            Abandon
          </button>
        </div>
      )}
    </div>
  )
}

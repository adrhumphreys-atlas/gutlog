import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { BottomSheet } from '../components/BottomSheet'
import { useToast } from '../components/Toast'
import { api, ApiRequestError } from '../lib/api'

interface Experiment {
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
  createdAt: string
}

const SUGGESTED_EXPERIMENTS = [
  {
    name: 'Go dairy-free',
    emoji: '🥛',
    description: 'Eliminate all dairy products to see if they trigger symptoms.',
    foods: ['dairy', 'milk', 'cheese', 'yogurt', 'butter', 'cream', 'ice cream', 'whey'],
    days: 21,
  },
  {
    name: 'Go gluten-free',
    emoji: '🌾',
    description: 'Eliminate gluten-containing grains to check for gluten sensitivity.',
    foods: ['gluten', 'wheat', 'bread', 'pasta', 'cereal', 'flour', 'barley', 'rye', 'couscous'],
    days: 21,
  },
  {
    name: 'Low FODMAP trial',
    emoji: '🧅',
    description: 'Cut high-FODMAP foods commonly linked to IBS symptoms.',
    foods: ['onion', 'garlic', 'beans', 'lentils', 'apple', 'pear', 'watermelon', 'mushroom', 'cauliflower', 'artichoke'],
    days: 28,
  },
  {
    name: 'Caffeine-free',
    emoji: '☕',
    description: 'Eliminate caffeine to see if it contributes to gut issues.',
    foods: ['coffee', 'espresso', 'caffeine', 'energy drink', 'black tea', 'green tea', 'cola'],
    days: 14,
  },
  {
    name: 'No spicy food',
    emoji: '🌶️',
    description: 'Avoid spicy foods to check if capsaicin triggers symptoms.',
    foods: ['chili', 'hot sauce', 'jalapeño', 'cayenne', 'sriracha', 'wasabi', 'curry', 'spicy'],
    days: 14,
  },
]

/**
 * Experiments Page (/experiments)
 *
 * Lists active, completed, and abandoned experiments.
 * Experiment creation via bottom sheet (can be pre-filled from Insights).
 */
export function ExperimentsPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { showToast } = useToast()
  const [experiments, setExperiments] = useState<Experiment[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)

  // Pre-fill from insights suggestion
  const suggestedFood = searchParams.get('suggest') || ''

  // Form state
  const [name, setName] = useState(
    suggestedFood ? `Eliminate ${suggestedFood}` : ''
  )
  const [description, setDescription] = useState('')
  const [eliminatedFoodsInput, setEliminatedFoodsInput] = useState(
    suggestedFood || ''
  )
  const [durationDays, setDurationDays] = useState('14')

  const prefillExperiment = (preset: typeof SUGGESTED_EXPERIMENTS[number]) => {
    setName(preset.name)
    setDescription(preset.description)
    setEliminatedFoodsInput(preset.foods.join(', '))
    setDurationDays(preset.days.toString())
    setShowCreate(true)
  }

  useEffect(() => {
    loadExperiments()
    if (suggestedFood) {
      setShowCreate(true)
    }
  }, [suggestedFood])

  const loadExperiments = async () => {
    setLoading(true)
    try {
      const data = await api.getExperiments()
      setExperiments(data)
    } catch (err) {
      if (err instanceof ApiRequestError && err.status === 401) return
      console.error('Failed to load experiments:', err)
    }
    setLoading(false)
  }

  const handleCreate = async () => {
    const foods = eliminatedFoodsInput
      .split(',')
      .map((f) => f.trim())
      .filter(Boolean)

    if (!name.trim() || foods.length === 0) return

    try {
      await api.createExperiment({
        name: name.trim(),
        description: description.trim() || undefined,
        eliminatedFoods: foods,
        durationDays: parseInt(durationDays) || 14,
      })
      showToast('Experiment started ✓')
      setShowCreate(false)
      setSearchParams({})
      resetForm()
      loadExperiments()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to create experiment')
    }
  }

  const resetForm = () => {
    setName('')
    setDescription('')
    setEliminatedFoodsInput('')
    setDurationDays('14')
  }

  const closeSheet = () => {
    setShowCreate(false)
    setSearchParams({})
  }

  const statusEmoji = (status: string) => {
    switch (status) {
      case 'active': return '🟢'
      case 'completed': return '✅'
      case 'abandoned': return '⏹️'
      default: return '🧪'
    }
  }

  const resultLabel = (result: string | null) => {
    switch (result) {
      case 'significant_improvement': return '🎉 Significant improvement!'
      case 'mild_improvement': return '📈 Mild improvement'
      case 'no_change': return '➡️ No change'
      case 'worsened': return '📉 Worsened'
      default: return null
    }
  }

  const daysProgress = (exp: Experiment): { current: number; total: number } => {
    const start = new Date(exp.startDate).getTime()
    const now = Date.now()
    const elapsed = Math.floor((now - start) / (24 * 60 * 60 * 1000))
    return { current: Math.min(elapsed, exp.durationDays), total: exp.durationDays }
  }

  const active = experiments.filter((e) => e.status === 'active')
  const completed = experiments.filter((e) => e.status === 'completed')
  const abandoned = experiments.filter((e) => e.status === 'abandoned')

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-stone-900">🧪 Experiments</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="px-4 py-2 text-sm font-medium bg-green-800 text-white rounded-xl hover:bg-green-700 transition-colors min-h-[44px]"
        >
          + New
        </button>
      </div>

      {loading ? (
        <div className="text-center py-16 text-stone-400">Loading...</div>
      ) : experiments.length === 0 ? (
        <div>
          <div className="text-center py-8">
            <p className="text-4xl mb-3">🧪</p>
            <p className="font-medium text-stone-700">No experiments yet</p>
            <p className="text-sm text-stone-500 mt-1">
              Try an elimination experiment to find your triggers
            </p>
          </div>

          {/* Suggested experiments */}
          <div className="mt-4">
            <h2 className="text-sm font-semibold text-stone-500 uppercase tracking-wide mb-3">
              Popular experiments to try
            </h2>
            <div className="space-y-2">
              {SUGGESTED_EXPERIMENTS.map((preset) => (
                <button
                  key={preset.name}
                  onClick={() => prefillExperiment(preset)}
                  className="w-full text-left p-4 bg-white border border-stone-200 rounded-2xl hover:border-green-300 hover:bg-green-50/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{preset.emoji}</span>
                    <div className="flex-1">
                      <p className="font-semibold text-stone-900 text-sm">
                        {preset.name}
                      </p>
                      <p className="text-xs text-stone-500 mt-0.5">
                        {preset.days} days · {preset.foods.length} items tracked
                      </p>
                    </div>
                    <span className="text-stone-400 text-sm">→</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Active */}
          {active.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-stone-500 uppercase tracking-wide mb-3">
                Active
              </h2>
              <div className="space-y-3">
                {active.map((exp) => {
                  const progress = daysProgress(exp)
                  return (
                    <button
                      key={exp.id}
                      onClick={() => navigate(`/experiments/${exp.id}`)}
                      className="w-full text-left p-4 bg-white border-2 border-green-300 rounded-2xl hover:border-green-400 transition-colors"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span>{statusEmoji(exp.status)}</span>
                        <span className="font-semibold text-stone-900">
                          {exp.name}
                        </span>
                      </div>
                      <p className="text-xs text-stone-500 mb-2">
                        Eliminating: {(exp.eliminatedFoods as string[]).join(', ')}
                      </p>
                      {/* Progress bar */}
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-stone-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-green-400 rounded-full transition-all"
                            style={{
                              width: `${(progress.current / progress.total) * 100}%`,
                            }}
                          />
                        </div>
                        <span className="text-xs text-stone-500">
                          Day {progress.current}/{progress.total}
                        </span>
                      </div>
                    </button>
                  )
                })}
              </div>
            </section>
          )}

          {/* Completed */}
          {completed.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-stone-500 uppercase tracking-wide mb-3">
                Completed
              </h2>
              <div className="space-y-3">
                {completed.map((exp) => (
                  <button
                    key={exp.id}
                    onClick={() => navigate(`/experiments/${exp.id}`)}
                    className="w-full text-left p-4 bg-white border border-stone-200 rounded-2xl hover:border-stone-300 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span>{statusEmoji(exp.status)}</span>
                        <span className="font-semibold text-stone-900">
                          {exp.name}
                        </span>
                      </div>
                    </div>
                    {exp.result && (
                      <p className="text-sm mt-1 text-stone-600">
                        {resultLabel(exp.result)}
                      </p>
                    )}
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* Abandoned */}
          {abandoned.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-stone-500 uppercase tracking-wide mb-3">
                Abandoned
              </h2>
              <div className="space-y-3">
                {abandoned.map((exp) => (
                  <button
                    key={exp.id}
                    onClick={() => navigate(`/experiments/${exp.id}`)}
                    className="w-full text-left p-4 bg-stone-50 border border-stone-200 rounded-2xl hover:border-stone-300 transition-colors opacity-60"
                  >
                    <div className="flex items-center gap-2">
                      <span>{statusEmoji(exp.status)}</span>
                      <span className="font-medium text-stone-700">
                        {exp.name}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* Suggested experiments (also shown when user has experiments) */}
          {active.length === 0 && (
            <section>
              <h2 className="text-sm font-semibold text-stone-500 uppercase tracking-wide mb-3">
                Try next
              </h2>
              <div className="space-y-2">
                {SUGGESTED_EXPERIMENTS
                  .filter((preset) => !experiments.some((e) => e.name === preset.name))
                  .slice(0, 3)
                  .map((preset) => (
                    <button
                      key={preset.name}
                      onClick={() => prefillExperiment(preset)}
                      className="w-full text-left p-3 bg-white border border-stone-200 rounded-2xl hover:border-green-300 hover:bg-green-50/30 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xl">{preset.emoji}</span>
                        <div className="flex-1">
                          <p className="font-medium text-stone-900 text-sm">{preset.name}</p>
                          <p className="text-xs text-stone-500">{preset.days} days</p>
                        </div>
                        <span className="text-stone-400 text-sm">→</span>
                      </div>
                    </button>
                  ))}
              </div>
            </section>
          )}
        </div>
      )}

      {/* Create Experiment Sheet */}
      <BottomSheet
        isOpen={showCreate}
        onClose={closeSheet}
        title="🧪 New Experiment"
        isDirty={name.length > 0 || eliminatedFoodsInput.length > 0}
      >
        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Experiment name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder='e.g. "Eliminate dairy"'
              className="w-full px-4 py-3 rounded-xl border border-stone-300 focus:border-green-400 focus:ring-2 focus:ring-green-100 outline-none text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Foods to eliminate (comma-separated)
            </label>
            <input
              type="text"
              value={eliminatedFoodsInput}
              onChange={(e) => setEliminatedFoodsInput(e.target.value)}
              placeholder="dairy, milk, cheese, yogurt, butter"
              className="w-full px-4 py-3 rounded-xl border border-stone-300 focus:border-green-400 focus:ring-2 focus:ring-green-100 outline-none text-sm"
            />
            <p className="text-xs text-stone-400 mt-1">
              Include variations — "dairy, milk, cheese, yogurt, cream"
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Duration (days)
            </label>
            <input
              type="number"
              value={durationDays}
              onChange={(e) => setDurationDays(e.target.value)}
              min="1"
              max="90"
              className="w-32 px-4 py-3 rounded-xl border border-stone-300 focus:border-green-400 focus:ring-2 focus:ring-green-100 outline-none text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Description (optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={1000}
              rows={2}
              placeholder="Why are you trying this..."
              className="w-full px-4 py-3 rounded-xl border border-stone-300 focus:border-green-400 focus:ring-2 focus:ring-green-100 outline-none text-sm resize-none"
            />
          </div>

          <button
            type="button"
            onClick={handleCreate}
            disabled={!name.trim() || !eliminatedFoodsInput.trim()}
            className="w-full py-3 bg-green-800 text-white font-semibold rounded-xl hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors min-h-[44px]"
          >
            Start Experiment
          </button>
        </div>
      </BottomSheet>
    </div>
  )
}

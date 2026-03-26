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

  const DURATION_OPTIONS = [
    { value: '7', label: '7 days' },
    { value: '14', label: '14 days' },
    { value: '21', label: '21 days' },
    { value: '30', label: '30 days' },
  ]

  const timeSince = (dateStr: string): string => {
    const diff = Date.now() - new Date(dateStr).getTime()
    const days = Math.floor(diff / (24 * 60 * 60 * 1000))
    if (days < 7) return `${days} day${days !== 1 ? 's' : ''} ago`
    const weeks = Math.floor(days / 7)
    if (weeks < 5) return `${weeks} week${weeks !== 1 ? 's' : ''} ago`
    const months = Math.floor(days / 30)
    return `${months} month${months !== 1 ? 's' : ''} ago`
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[15px] font-semibold text-[#555]">
          🔬 Experiments
        </h2>
        <button
          onClick={() => setShowCreate(true)}
          className="px-3 py-1.5 text-[11px] font-medium text-[#4a7c59] bg-white border border-[#4a7c59] rounded-lg hover:bg-[#f0f7f0] transition-colors min-h-[44px]"
        >
          + New
        </button>
      </div>

      {loading ? (
        <div className="text-center py-16 text-[#767676]">Loading...</div>
      ) : experiments.length === 0 ? (
        /* Screen 12 — Empty State */
        <div>
          <div className="text-center py-8 px-4">
            <span className="text-5xl block mb-3">🧪</span>
            <p className="text-sm text-[#666]">No experiments yet.</p>
            <p className="text-[13px] text-[#767676] mt-1 leading-snug">
              When you have enough data, we'll suggest your first elimination experiment to help identify your triggers.
            </p>
          </div>

          {/* Suggested experiments */}
          <div className="mt-4 space-y-2.5">
            {SUGGESTED_EXPERIMENTS.map((preset) => (
              <button
                key={preset.name}
                onClick={() => prefillExperiment(preset)}
                className="w-full text-left border border-[#ddd] rounded-[10px] p-3 bg-white hover:bg-[#fafaf9] transition-colors"
              >
                <div className="text-[10px] uppercase tracking-[0.5px] text-[#767676] font-semibold">
                  Suggested
                </div>
                <div className="text-[13px] mt-1">
                  <strong>{preset.emoji} {preset.name}</strong>
                </div>
                <div className="text-xs text-[#666] mt-0.5">
                  {preset.description}
                </div>
                <span className="inline-block mt-1.5 px-3 py-1 text-[11px] font-medium text-[#4a7c59] bg-white border border-[#4a7c59] rounded-lg">
                  Start This Experiment
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        /* Screen 11 — With Data */
        <div className="space-y-2.5">
          {/* Active experiments */}
          {active.map((exp) => {
            const progress = daysProgress(exp)
            return (
              <button
                key={exp.id}
                onClick={() => navigate(`/experiments/${exp.id}`)}
                className="w-full text-left border-2 border-[#4a7c59] rounded-[10px] p-3 bg-[#f0f7f0] hover:bg-[#e8f2ea] transition-colors"
              >
                <div className="text-[10px] uppercase tracking-[0.5px] text-[#4a7c59] font-semibold">
                  Active — Day {progress.current} of {progress.total}
                </div>
                <div className="text-[13px] mt-1">
                  <strong>{exp.name}</strong>
                </div>
                {exp.description && (
                  <div className="text-xs text-[#555] mt-1">{exp.description}</div>
                )}
                {/* Progress bar */}
                <div className="h-1.5 bg-[#ddd] rounded-full mt-1.5 overflow-hidden">
                  <div
                    className="h-full bg-[#4a7c59] rounded-full transition-all"
                    style={{ width: `${(progress.current / progress.total) * 100}%` }}
                  />
                </div>
                {/* Symptom comparison */}
                {exp.baselineSymptomRate != null && exp.currentSymptomRate != null && (
                  <div className="text-[11px] text-[#767676] mt-1.5">
                    So far: Avg symptoms <strong>{exp.currentSymptomRate.toFixed(1)}/day</strong> vs{' '}
                    <strong>{exp.baselineSymptomRate.toFixed(1)}/day</strong> before trial
                  </div>
                )}
              </button>
            )
          })}

          {/* Completed experiments */}
          {completed.map((exp) => (
            <button
              key={exp.id}
              onClick={() => navigate(`/experiments/${exp.id}`)}
              className="w-full text-left border border-[#ddd] rounded-[10px] p-3 bg-white hover:bg-[#fafaf9] transition-colors"
            >
              <div className="text-[10px] uppercase tracking-[0.5px] text-[#767676] font-semibold">
                Completed — {exp.endDate ? timeSince(exp.endDate) : ''}
              </div>
              <div className="text-[13px] mt-1">
                <strong>{exp.name}</strong>
              </div>
              {exp.result && (
                <div className="text-xs text-[#4a7c59] mt-0.5">
                  {resultLabel(exp.result)}
                </div>
              )}
            </button>
          ))}

          {/* Abandoned experiments */}
          {abandoned.map((exp) => (
            <button
              key={exp.id}
              onClick={() => navigate(`/experiments/${exp.id}`)}
              className="w-full text-left border border-[#ddd] rounded-[10px] p-3 bg-white hover:bg-[#fafaf9] transition-colors opacity-60"
            >
              <div className="text-[10px] uppercase tracking-[0.5px] text-[#767676] font-semibold">
                Abandoned
              </div>
              <div className="text-[13px] mt-1">
                <strong>{exp.name}</strong>
              </div>
            </button>
          ))}

          {/* Suggested — shown when no active experiment */}
          {active.length === 0 && SUGGESTED_EXPERIMENTS
            .filter((preset) => !experiments.some((e) => e.name === preset.name))
            .slice(0, 2)
            .map((preset) => (
              <button
                key={preset.name}
                onClick={() => prefillExperiment(preset)}
                className="w-full text-left border border-[#ddd] rounded-[10px] p-3 bg-white hover:bg-[#fafaf9] transition-colors"
              >
                <div className="text-[10px] uppercase tracking-[0.5px] text-[#767676] font-semibold">
                  Suggested by Pattern Spotter
                </div>
                <div className="text-[13px] mt-1">
                  <strong>{preset.emoji} {preset.name}</strong>
                </div>
                <div className="text-xs text-[#666] mt-0.5">{preset.description}</div>
                <span className="inline-block mt-1.5 px-3 py-1 text-[11px] font-medium text-[#4a7c59] bg-white border border-[#4a7c59] rounded-lg">
                  Start This Experiment
                </span>
              </button>
            ))}
        </div>
      )}

      {/* Screen 13 — Create Experiment Bottom Sheet */}
      <BottomSheet
        isOpen={showCreate}
        onClose={closeSheet}
        title="🔬 Start Experiment"
        isDirty={name.length > 0 || eliminatedFoodsInput.length > 0}
      >
        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-[#666] block mb-1">
              Experiment Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder='e.g. "Dairy-free trial"'
              className="w-full px-2.5 py-2 rounded-md border border-[#ddd] focus:border-[#4a7c59] focus:ring-2 focus:ring-[#4a7c59/15] outline-none text-[13px]"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-[#666] block mb-1">
              What to eliminate
            </label>
            <input
              type="text"
              value={eliminatedFoodsInput}
              onChange={(e) => setEliminatedFoodsInput(e.target.value)}
              placeholder="All dairy products (milk, cheese, yogurt, butter)"
              className="w-full px-2.5 py-2 rounded-md border border-[#ddd] focus:border-[#4a7c59] focus:ring-2 focus:ring-[#4a7c59/15] outline-none text-[13px]"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-[#666] block mb-1">
              Duration
            </label>
            <div className="flex flex-wrap gap-1">
              {DURATION_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setDurationDays(opt.value)}
                  className={`px-3.5 py-2 text-xs rounded-lg border-2 min-w-[44px] min-h-[44px] flex items-center justify-center transition-colors ${
                    durationDays === opt.value
                      ? 'border-[#4a7c59] bg-[#f0f7f0]'
                      : 'border-transparent hover:bg-[#fafaf9]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Auto-filled reason (shown when pre-filled from insights) */}
          {suggestedFood && description && (
            <div>
              <label className="text-xs font-semibold text-[#666] block mb-1">
                Why? (auto-filled from pattern)
              </label>
              <div className="text-xs text-[#666] p-2 bg-[#faf7ff] rounded-md">
                {description}
              </div>
            </div>
          )}

          {/* Manual description (shown when NOT pre-filled) */}
          {!suggestedFood && (
            <div>
              <label className="text-xs font-semibold text-[#666] block mb-1">
                Description (optional)
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={1000}
                rows={2}
                placeholder="Why are you trying this..."
                className="w-full px-2.5 py-2 rounded-md border border-[#ddd] focus:border-[#4a7c59] focus:ring-2 focus:ring-[#4a7c59/15] outline-none text-[13px] resize-none"
              />
            </div>
          )}

          <button
            type="button"
            onClick={handleCreate}
            disabled={!name.trim() || !eliminatedFoodsInput.trim()}
            className="w-full py-2.5 bg-[#4a7c59] text-white font-semibold rounded-lg hover:bg-[#3d6a4a] disabled:opacity-40 disabled:cursor-not-allowed transition-colors min-h-[44px] text-sm mt-2"
          >
            🔬 Start Experiment
          </button>
        </div>
      </BottomSheet>
    </div>
  )
}

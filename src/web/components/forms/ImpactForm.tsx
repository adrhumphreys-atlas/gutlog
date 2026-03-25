import { useState } from 'react'

interface ImpactFormProps {
  onSave: (data: any) => void
  onDelete?: () => void
  initialData?: any
  isEdit?: boolean
}

const IMPACT_LEVELS = [
  { value: 'none', emoji: '✅', label: 'None' },
  { value: 'mild', emoji: '😐', label: 'Mild' },
  { value: 'moderate', emoji: '😕', label: 'Moderate' },
  { value: 'severe', emoji: '😫', label: 'Severe' },
]

const ACTIVITY_OPTIONS = [
  'Work', 'Exercise', 'Social', 'Sleep', 'Eating', 'Travel', 'Chores',
]

export function ImpactForm({ onSave, onDelete, initialData, isEdit }: ImpactFormProps) {
  const [impactSeverity, setImpactSeverity] = useState(initialData?.impactSeverity || '')
  const [affectedActivities, setAffectedActivities] = useState<string[]>(
    initialData?.affectedActivities || []
  )
  const [description, setDescription] = useState(initialData?.description || '')

  const toggleActivity = (activity: string) => {
    setAffectedActivities((prev) =>
      prev.includes(activity)
        ? prev.filter((a) => a !== activity)
        : [...prev, activity]
    )
  }

  const handleSubmit = () => {
    if (!impactSeverity) return
    onSave({
      type: 'impact',
      timestamp: new Date().toISOString(),
      impactSeverity,
      affectedActivities: affectedActivities.length > 0 ? affectedActivities : undefined,
      description: description || undefined,
    })
  }

  return (
    <div className="space-y-5">
      {/* Impact Severity */}
      <div>
        <span className="block text-sm font-medium text-stone-700 mb-2">
          How much did gut issues affect your day?
        </span>
        <div className="flex gap-1.5 flex-wrap">
          {IMPACT_LEVELS.map((level) => (
            <button
              key={level.value}
              type="button"
              onClick={() => setImpactSeverity(level.value)}
              className={`flex flex-col items-center gap-0.5 p-2 min-w-[44px] min-h-[44px] rounded-xl border-2 transition-colors ${
                impactSeverity === level.value
                  ? 'border-green-400 bg-green-50'
                  : 'border-transparent hover:bg-stone-50'
              }`}
            >
              <span className="text-xl">{level.emoji}</span>
              <span className="text-[10px] text-stone-500">{level.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Affected Activities */}
      <div>
        <span className="block text-sm font-medium text-stone-700 mb-2">
          What was affected? (optional)
        </span>
        <div className="flex gap-2 flex-wrap">
          {ACTIVITY_OPTIONS.map((activity) => (
            <button
              key={activity}
              type="button"
              onClick={() => toggleActivity(activity)}
              className={`px-3 py-2 text-sm rounded-xl border transition-colors min-h-[44px] ${
                affectedActivities.includes(activity)
                  ? 'border-green-400 bg-green-50 text-green-800'
                  : 'border-stone-200 text-stone-600 hover:bg-stone-50'
              }`}
            >
              {activity}
            </button>
          ))}
        </div>
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-stone-700 mb-1">
          Description (optional)
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={1000}
          rows={3}
          placeholder="How did it affect you..."
          className="w-full px-4 py-3 rounded-xl border border-stone-300 focus:border-green-400 focus:ring-2 focus:ring-green-100 outline-none text-sm resize-none"
        />
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!impactSeverity}
          className="flex-1 py-3 bg-green-800 text-white font-semibold rounded-xl hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors min-h-[44px]"
        >
          {isEdit ? 'Update' : 'Save'}
        </button>
        {isEdit && onDelete && (
          <button
            type="button"
            onClick={onDelete}
            className="py-3 px-4 text-red-600 font-medium rounded-xl hover:bg-red-50 transition-colors min-h-[44px]"
          >
            🗑 Delete
          </button>
        )}
      </div>
    </div>
  )
}

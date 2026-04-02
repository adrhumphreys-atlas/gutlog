import { useState } from 'react'
import { DateTimeField } from '../DateTimeField'

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
  const [timestamp, setTimestamp] = useState(initialData?.timestamp || new Date().toISOString())
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
      timestamp,
      impactSeverity,
      affectedActivities: affectedActivities.length > 0 ? affectedActivities : undefined,
      description: description || undefined,
    })
  }

  return (
    <div className="space-y-5">
      {/* Date & Time */}
      {isEdit && (
        <DateTimeField value={timestamp} onChange={setTimestamp} />
      )}

      {/* Impact Severity */}
      <div>
        <span className="block text-xs font-semibold text-[var(--text-label)] mb-2">
          How much did gut issues affect your day?
        </span>
        <div className="flex gap-1.5 flex-wrap">
          {IMPACT_LEVELS.map((level) => (
            <button
              key={level.value}
              type="button"
              onClick={() => setImpactSeverity(level.value)}
              className={`flex flex-col items-center gap-0.5 p-2 min-w-[44px] min-h-[44px] rounded-lg border-2 transition-colors ${
                impactSeverity === level.value
                  ? 'border-[var(--green-primary)] bg-[var(--green-light)]'
                  : 'border-transparent hover:bg-[var(--bg-hover)]'
              }`}
            >
              <span className="text-xl">{level.emoji}</span>
              <span className="text-[10px] text-[var(--text-muted)]">{level.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Affected Activities */}
      <div>
        <span className="block text-xs font-semibold text-[var(--text-label)] mb-2">
          What was affected? (optional)
        </span>
        <div className="flex gap-2 flex-wrap">
          {ACTIVITY_OPTIONS.map((activity) => (
            <button
              key={activity}
              type="button"
              onClick={() => toggleActivity(activity)}
              className={`px-3 py-2 text-xs rounded-lg border transition-colors min-h-[44px] ${
                affectedActivities.includes(activity)
                  ? 'border-[var(--green-primary)] bg-[var(--green-light)] text-[var(--green-primary)]'
                  : 'border-[var(--border-default)] text-[var(--text-label)] hover:bg-[var(--bg-hover)]'
              }`}
            >
              {activity}
            </button>
          ))}
        </div>
      </div>

      {/* Description */}
      <div>
        <label className="block text-xs font-semibold text-[var(--text-label)] mb-1">
          Description (optional)
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={1000}
          rows={3}
          placeholder="How did it affect you..."
          className="w-full px-2.5 py-2 rounded-md border border-[var(--border-default)] focus:border-[var(--green-primary)] focus:ring-2 focus:ring-[var(--green-primary)]/15 outline-none text-sm resize-none bg-[var(--bg-input)] text-[var(--text-primary)]"
        />
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!impactSeverity}
          className="flex-1 py-2.5 bg-[var(--green-primary)] text-white text-sm font-semibold rounded-lg hover:bg-[var(--green-hover)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors min-h-[44px]"
        >
          {isEdit ? 'Update' : 'Save'}
        </button>
        {isEdit && onDelete && (
          <button
            type="button"
            onClick={onDelete}
            className="py-2.5 px-3 text-[var(--danger-text)] text-sm font-medium rounded-lg hover:bg-[var(--danger-bg-hover)] transition-colors min-h-[44px]"
          >
            🗑 Delete
          </button>
        )}
      </div>
    </div>
  )
}

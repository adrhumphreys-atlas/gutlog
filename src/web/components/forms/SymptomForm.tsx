import { useState } from 'react'
import { EmojiScale, SEVERITY_SCALE } from '../EmojiScale'

interface SymptomFormProps {
  onSave: (data: any) => void
  onDelete?: () => void
  initialData?: any
  isEdit?: boolean
}

const SYMPTOM_TYPES = [
  { value: 'bloating', emoji: '🎈', label: 'Bloating' },
  { value: 'pain', emoji: '😣', label: 'Pain' },
  { value: 'nausea', emoji: '🤢', label: 'Nausea' },
  { value: 'gas', emoji: '💨', label: 'Gas' },
  { value: 'cramps', emoji: '🔪', label: 'Cramps' },
  { value: 'fatigue', emoji: '😴', label: 'Fatigue' },
  { value: 'other', emoji: '❓', label: 'Other' },
]

const LOCATIONS = [
  { value: 'upper_left', label: 'Upper Left' },
  { value: 'upper_right', label: 'Upper Right' },
  { value: 'lower_left', label: 'Lower Left' },
  { value: 'lower_right', label: 'Lower Right' },
  { value: 'central', label: 'Central' },
  { value: 'all', label: 'All Over' },
]

export function SymptomForm({ onSave, onDelete, initialData, isEdit }: SymptomFormProps) {
  const [symptomType, setSymptomType] = useState(initialData?.symptomType || '')
  const [severity, setSeverity] = useState<number | null>(initialData?.severity || null)
  const [location, setLocation] = useState(initialData?.location || '')
  const [duration, setDuration] = useState(initialData?.duration?.toString() || '')
  const [notes, setNotes] = useState(initialData?.notes || '')

  const handleSubmit = () => {
    if (!symptomType || severity === null) return

    onSave({
      type: 'symptom',
      timestamp: new Date().toISOString(),
      symptomType,
      severity,
      location: location || undefined,
      duration: duration ? parseInt(duration) : undefined,
      notes: notes || undefined,
    })
  }

  return (
    <div className="space-y-5">
      {/* Symptom Type */}
      <div>
        <span className="block text-sm font-medium text-stone-700 mb-2">
          What symptom?
        </span>
        <div className="flex gap-1.5 flex-wrap">
          {SYMPTOM_TYPES.map((st) => (
            <button
              key={st.value}
              type="button"
              onClick={() => setSymptomType(st.value)}
              className={`flex flex-col items-center gap-0.5 p-2 min-w-[44px] min-h-[44px] rounded-xl border-2 transition-colors ${
                symptomType === st.value
                  ? 'border-green-400 bg-green-50'
                  : 'border-transparent hover:bg-stone-50'
              }`}
            >
              <span className="text-xl">{st.emoji}</span>
              <span className="text-[10px] text-stone-500">{st.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Severity */}
      <EmojiScale
        options={SEVERITY_SCALE}
        value={severity}
        onChange={setSeverity}
        label="How bad is it?"
      />

      {/* Location (optional) */}
      <div>
        <span className="block text-sm font-medium text-stone-700 mb-2">
          Where? (optional)
        </span>
        <div className="flex gap-2 flex-wrap">
          {LOCATIONS.map((loc) => (
            <button
              key={loc.value}
              type="button"
              onClick={() =>
                setLocation(location === loc.value ? '' : loc.value)
              }
              className={`px-3 py-2 text-sm rounded-xl border transition-colors min-h-[44px] ${
                location === loc.value
                  ? 'border-green-400 bg-green-50 text-green-800'
                  : 'border-stone-200 text-stone-600 hover:bg-stone-50'
              }`}
            >
              {loc.label}
            </button>
          ))}
        </div>
      </div>

      {/* Duration (optional) */}
      <div>
        <label className="block text-sm font-medium text-stone-700 mb-1">
          Duration in minutes (optional)
        </label>
        <input
          type="number"
          value={duration}
          onChange={(e) => setDuration(e.target.value)}
          min="1"
          placeholder="e.g. 30"
          className="w-32 px-4 py-3 rounded-xl border border-stone-300 focus:border-green-400 focus:ring-2 focus:ring-green-100 outline-none text-sm"
        />
      </div>

      {/* Notes */}
      <div>
        <label className="block text-sm font-medium text-stone-700 mb-1">
          Notes (optional)
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          maxLength={1000}
          rows={2}
          placeholder="Any additional details..."
          className="w-full px-4 py-3 rounded-xl border border-stone-300 focus:border-green-400 focus:ring-2 focus:ring-green-100 outline-none text-sm resize-none"
        />
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!symptomType || severity === null}
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

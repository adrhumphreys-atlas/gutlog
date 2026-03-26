import { useState } from 'react'
import { DateTimeField } from '../DateTimeField'

interface SymptomFormProps {
  onSave: (data: any) => void
  onDelete?: () => void
  initialData?: any
  isEdit?: boolean
}

const SYMPTOM_TYPES = [
  { value: 'bloating', emoji: '🎈', label: 'Bloating' },
  { value: 'pain', emoji: '🔥', label: 'Pain' },
  { value: 'nausea', emoji: '🤢', label: 'Nausea' },
  { value: 'gas', emoji: '💨', label: 'Gas' },
  { value: 'cramps', emoji: '😫', label: 'Cramps' },
  { value: 'fatigue', emoji: '🫠', label: 'Fatigue' },
]

const SEVERITY_OPTIONS = [
  { value: 1, emoji: '😌', label: 'Mild' },
  { value: 2, emoji: '😐', label: 'Slight' },
  { value: 3, emoji: '😣', label: 'Moderate' },
  { value: 4, emoji: '😖', label: 'Severe' },
  { value: 5, emoji: '🥴', label: 'Intense' },
]

export function SymptomForm({ onSave, onDelete, initialData, isEdit }: SymptomFormProps) {
  const [timestamp, setTimestamp] = useState(initialData?.timestamp || new Date().toISOString())
  const [symptomType, setSymptomType] = useState(initialData?.symptomType || '')
  const [severity, setSeverity] = useState<number | null>(initialData?.severity || null)
  const [notes, setNotes] = useState(initialData?.notes || '')

  const handleSubmit = () => {
    if (!symptomType || severity === null) return

    onSave({
      type: 'symptom',
      timestamp,
      symptomType,
      severity,
      notes: notes || undefined,
    })
  }

  return (
    <div className="space-y-5">
      {/* Date & Time */}
      {isEdit && (
        <DateTimeField value={timestamp} onChange={setTimestamp} />
      )}

      {/* Symptom Type — 2-column grid */}
      <div>
        <span className="block text-xs font-semibold text-[#666] mb-2">
          What are you feeling?
        </span>
        <div className="grid grid-cols-2 gap-2">
          {SYMPTOM_TYPES.map((st) => (
            <button
              key={st.value}
              type="button"
              onClick={() => setSymptomType(st.value)}
              className={`flex items-center gap-2 px-3 py-3 rounded-[10px] border text-left transition-colors min-h-[56px] ${
                symptomType === st.value
                  ? 'border-[#e89b5e] bg-orange-50'
                  : 'border-[#ddd] bg-white hover:bg-[#fafaf9]'
              }`}
            >
              <span className="text-2xl">{st.emoji}</span>
              <span className="text-xs font-semibold text-[#666]">{st.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Severity (1-5) */}
      <div>
        <span className="block text-xs font-semibold text-[#666] mb-2">
          Severity (1–5)
        </span>
        <div
          role="radiogroup"
          aria-label="Severity"
          className="flex gap-1.5"
        >
          {SEVERITY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={severity === opt.value}
              aria-label={`${opt.label} (${opt.value})`}
              onClick={() => setSeverity(opt.value)}
              className={`flex flex-col items-center gap-0.5 p-2 min-w-[44px] min-h-[44px] rounded-lg border-2 transition-colors ${
                severity === opt.value
                  ? 'border-[#e89b5e] bg-orange-50'
                  : 'border-transparent hover:bg-[#fafaf9]'
              }`}
            >
              <span className="text-xl">{opt.emoji}</span>
              <span className="text-[10px] text-[#767676] leading-tight">{opt.label}</span>
            </button>
          ))}
        </div>
        <div className="text-[11px] text-[#767676] mt-1">
          {SEVERITY_OPTIONS.map((o) => `${o.value} ${o.label}`).join(' · ')}
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className="block text-xs font-semibold text-[#666] mb-1">
          Notes (optional)
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          maxLength={1000}
          rows={2}
          placeholder="Any additional details..."
          className="w-full px-2.5 py-2 rounded-md border border-[#ddd] focus:border-[#e89b5e] focus:ring-2 focus:ring-orange-100 outline-none text-sm resize-none"
        />
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!symptomType || severity === null}
          className="flex-1 py-2.5 bg-[#4a7c59] text-white text-sm font-semibold rounded-lg hover:bg-[#3d6a4a] disabled:opacity-40 disabled:cursor-not-allowed transition-colors min-h-[44px]"
        >
          {isEdit ? 'Update' : 'Save'}
        </button>
        {isEdit && onDelete && (
          <button
            type="button"
            onClick={onDelete}
            className="py-2.5 px-3 text-red-600 text-sm font-medium rounded-lg hover:bg-red-50 transition-colors min-h-[44px]"
          >
            🗑 Delete
          </button>
        )}
      </div>
    </div>
  )
}

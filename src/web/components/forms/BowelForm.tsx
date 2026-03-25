import { useState } from 'react'
import { EmojiScale, BRISTOL_SCALE } from '../EmojiScale'

interface BowelFormProps {
  onSave: (data: any) => void
  onDelete?: () => void
  initialData?: any
  isEdit?: boolean
}

const URGENCY_OPTIONS = [
  { value: 'none', label: 'None' },
  { value: 'mild', label: 'Mild' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'severe', label: 'Severe' },
]

export function BowelForm({ onSave, onDelete, initialData, isEdit }: BowelFormProps) {
  const [bristolType, setBristolType] = useState<number | null>(
    initialData?.bristolType || null
  )
  const [urgency, setUrgency] = useState(initialData?.urgency || '')
  const [blood, setBlood] = useState(initialData?.blood || false)
  const [mucus, setMucus] = useState(initialData?.mucus || false)
  const [notes, setNotes] = useState(initialData?.notes || '')

  const handleSubmit = () => {
    if (bristolType === null) return

    onSave({
      type: 'bowel',
      timestamp: new Date().toISOString(),
      bristolType,
      urgency: urgency || undefined,
      blood: blood || undefined,
      mucus: mucus || undefined,
      notes: notes || undefined,
    })
  }

  return (
    <div className="space-y-5">
      {/* Bristol Scale */}
      <EmojiScale
        options={BRISTOL_SCALE}
        value={bristolType}
        onChange={setBristolType}
        label="Bristol Stool Type"
      />

      {/* Urgency */}
      <div>
        <span className="block text-sm font-medium text-stone-700 mb-2">
          Urgency (optional)
        </span>
        <div className="flex gap-2 flex-wrap">
          {URGENCY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() =>
                setUrgency(urgency === opt.value ? '' : opt.value)
              }
              className={`px-3 py-2 text-sm rounded-xl border transition-colors min-h-[44px] ${
                urgency === opt.value
                  ? 'border-green-400 bg-green-50 text-green-800'
                  : 'border-stone-200 text-stone-600 hover:bg-stone-50'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Flags */}
      <div className="flex gap-4">
        <label className="flex items-center gap-2 cursor-pointer min-h-[44px]">
          <input
            type="checkbox"
            checked={blood}
            onChange={(e) => setBlood(e.target.checked)}
            className="w-5 h-5 rounded border-stone-300 text-red-600 focus:ring-red-200"
          />
          <span className="text-sm text-stone-700">🩸 Blood</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer min-h-[44px]">
          <input
            type="checkbox"
            checked={mucus}
            onChange={(e) => setMucus(e.target.checked)}
            className="w-5 h-5 rounded border-stone-300 text-yellow-600 focus:ring-yellow-200"
          />
          <span className="text-sm text-stone-700">💧 Mucus</span>
        </label>
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
          disabled={bristolType === null}
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

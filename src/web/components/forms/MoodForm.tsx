import { useState } from 'react'
import { EmojiScale, MOOD_SCALE, STRESS_SCALE, SLEEP_SCALE } from '../EmojiScale'

interface MoodFormProps {
  onSave: (data: any) => void
  onDelete?: () => void
  initialData?: any
  isEdit?: boolean
}

export function MoodForm({ onSave, onDelete, initialData, isEdit }: MoodFormProps) {
  const [mood, setMood] = useState<number | null>(initialData?.mood || null)
  const [stressLevel, setStressLevel] = useState<number | null>(
    initialData?.stressLevel || null
  )
  const [sleepQuality, setSleepQuality] = useState<number | null>(
    initialData?.sleepQuality || null
  )
  const [anxietyLevel, setAnxietyLevel] = useState<number | null>(
    initialData?.anxietyLevel || null
  )
  const [notes, setNotes] = useState(initialData?.notes || '')

  const handleSubmit = () => {
    if (mood === null) return

    onSave({
      type: 'emotion',
      timestamp: new Date().toISOString(),
      mood,
      stressLevel: stressLevel ?? undefined,
      sleepQuality: sleepQuality ?? undefined,
      anxietyLevel: anxietyLevel ?? undefined,
      notes: notes || undefined,
    })
  }

  return (
    <div className="space-y-5">
      {/* Mood (required) */}
      <EmojiScale
        options={MOOD_SCALE}
        value={mood}
        onChange={setMood}
        label="How are you feeling?"
      />

      {/* Stress (optional) */}
      <EmojiScale
        options={STRESS_SCALE}
        value={stressLevel}
        onChange={setStressLevel}
        label="Stress level (optional)"
      />

      {/* Sleep (optional) */}
      <EmojiScale
        options={SLEEP_SCALE}
        value={sleepQuality}
        onChange={setSleepQuality}
        label="Sleep quality (optional)"
      />

      {/* Anxiety (optional — reuse stress scale visuals) */}
      <EmojiScale
        options={STRESS_SCALE}
        value={anxietyLevel}
        onChange={setAnxietyLevel}
        label="Anxiety level (optional)"
      />

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
          placeholder="What's on your mind..."
          className="w-full px-4 py-3 rounded-xl border border-stone-300 focus:border-green-400 focus:ring-2 focus:ring-green-100 outline-none text-sm resize-none"
        />
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={mood === null}
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

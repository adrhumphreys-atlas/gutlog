import { useState } from 'react'
import { EmojiScale, MOOD_SCALE, STRESS_SCALE, SLEEP_SCALE } from '../EmojiScale'
import { DateTimeField } from '../DateTimeField'

interface MoodFormProps {
  onSave: (data: any) => void
  onDelete?: () => void
  initialData?: any
  isEdit?: boolean
}

export function MoodForm({ onSave, onDelete, initialData, isEdit }: MoodFormProps) {
  const [timestamp, setTimestamp] = useState(initialData?.timestamp || new Date().toISOString())
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
      timestamp,
      mood,
      stressLevel: stressLevel ?? undefined,
      sleepQuality: sleepQuality ?? undefined,
      anxietyLevel: anxietyLevel ?? undefined,
      notes: notes || undefined,
    })
  }

  return (
    <div className="space-y-5">
      {/* Date & Time */}
      {isEdit && (
        <DateTimeField value={timestamp} onChange={setTimestamp} />
      )}

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
        <label className="block text-xs font-semibold text-[var(--text-label)] mb-1">
          Notes (optional)
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          maxLength={1000}
          rows={2}
          placeholder="What's on your mind..."
          className="w-full px-2.5 py-2 rounded-md border border-[var(--border-default)] focus:border-[var(--green-primary)] focus:ring-2 focus:ring-[var(--green-primary)]/15 outline-none text-sm resize-none bg-[var(--bg-input)] text-[var(--text-primary)]"
        />
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={mood === null}
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

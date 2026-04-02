import { useState } from 'react'
import { DateTimeField } from '../DateTimeField'

interface NoteFormProps {
  onSave: (data: any) => void
  onDelete?: () => void
  initialData?: any
  isEdit?: boolean
}

export function NoteForm({ onSave, onDelete, initialData, isEdit }: NoteFormProps) {
  const [timestamp, setTimestamp] = useState(initialData?.timestamp || new Date().toISOString())
  const [notes, setNotes] = useState(initialData?.notes || '')

  const handleSubmit = () => {
    if (!notes.trim()) return
    onSave({
      type: 'note',
      timestamp,
      notes: notes.trim(),
    })
  }

  return (
    <div className="space-y-5">
      {/* Date & Time */}
      {isEdit && (
        <DateTimeField value={timestamp} onChange={setTimestamp} />
      )}

      <div>
        <label className="block text-xs font-semibold text-[var(--text-label)] mb-1">
          What's on your mind?
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          maxLength={1000}
          rows={5}
          autoFocus
          placeholder="Jot down anything — observations, how you're feeling, what you ate somewhere else..."
          className="w-full px-2.5 py-2 rounded-md border border-[var(--border-default)] focus:border-[var(--green-primary)] focus:ring-2 focus:ring-[var(--green-primary)]/15 outline-none text-sm resize-none bg-[var(--bg-input)] text-[var(--text-primary)]"
        />
        <p className="text-xs text-[var(--text-hint)] mt-1 text-right">
          {notes.length}/1000
        </p>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!notes.trim()}
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

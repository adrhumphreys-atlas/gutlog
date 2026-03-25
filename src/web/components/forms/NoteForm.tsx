import { useState } from 'react'

interface NoteFormProps {
  onSave: (data: any) => void
  onDelete?: () => void
  initialData?: any
  isEdit?: boolean
}

export function NoteForm({ onSave, onDelete, initialData, isEdit }: NoteFormProps) {
  const [notes, setNotes] = useState(initialData?.notes || '')

  const handleSubmit = () => {
    if (!notes.trim()) return
    onSave({
      type: 'note',
      timestamp: new Date().toISOString(),
      notes: notes.trim(),
    })
  }

  return (
    <div className="space-y-5">
      <div>
        <label className="block text-sm font-medium text-stone-700 mb-1">
          What's on your mind?
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          maxLength={1000}
          rows={5}
          autoFocus
          placeholder="Jot down anything — observations, how you're feeling, what you ate somewhere else..."
          className="w-full px-4 py-3 rounded-xl border border-stone-300 focus:border-green-400 focus:ring-2 focus:ring-green-100 outline-none text-sm resize-none"
        />
        <p className="text-xs text-stone-400 mt-1 text-right">
          {notes.length}/1000
        </p>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!notes.trim()}
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

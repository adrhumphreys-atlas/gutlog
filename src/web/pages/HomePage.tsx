import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { BottomSheet } from '../components/BottomSheet'
import { useToast } from '../components/Toast'
import { MealForm } from '../components/forms/MealForm'
import { SymptomForm } from '../components/forms/SymptomForm'
import { BowelForm } from '../components/forms/BowelForm'
import { MoodForm } from '../components/forms/MoodForm'
import { ImpactForm } from '../components/forms/ImpactForm'
import { NoteForm } from '../components/forms/NoteForm'
import { api, ApiRequestError } from '../lib/api'
import { TimelineSkeleton } from '../components/Skeleton'

// ─── Entry type config ───────────────────────────────────────────────

const ENTRY_TYPES = [
  { type: 'meal', emoji: '🍽️', label: 'Meal', dot: 'bg-orange-500' },
  { type: 'symptom', emoji: '🤕', label: 'Symptom', dot: 'bg-red-500' },
  { type: 'bowel', emoji: '💩', label: 'BM', dot: 'bg-purple-500' },
  { type: 'emotion', emoji: '😊', label: 'Mood', dot: 'bg-blue-500' },
  { type: 'impact', emoji: '⚡', label: 'Impact', dot: 'bg-yellow-500' },
  { type: 'note', emoji: '📝', label: 'Note', dot: 'bg-gray-500' },
] as const

const SHEET_TITLES: Record<string, string> = {
  meal: '🍽️ Log Meal',
  symptom: '🤕 Log Symptom',
  bowel: '💩 Log BM',
  emotion: '😊 Log Mood',
  impact: '⚡ Log Impact',
  note: '📝 Add Note',
}

/**
 * Home Page (/)
 *
 * ┌─────────────────────────┐
 * │   ‹  Today  ›  🌿 3    │  DateHeader + streak
 * ├─────────────────────────┤
 * │  🟠 12:30  Lunch        │  Timeline entries
 * │  🔴 14:00  Bloating 3/5 │
 * │  🔵 15:30  Mood 😊      │
 * ├─────────────────────────┤
 * │  🍽️  🤕  💩  😊  ⚡  📝  │  QuickLogGrid
 * └─────────────────────────┘
 */
/** Return today's date as YYYY-MM-DD in the user's local timezone. */
function localDateStr(d: Date = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function HomePage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { showToast } = useToast()
  const [selectedDate, setSelectedDate] = useState(localDateStr())
  const [entries, setEntries] = useState<any[]>([])
  const [streak, setStreak] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editEntry, setEditEntry] = useState<any>(null)
  const [hasEverLogged, setHasEverLogged] = useState(true)

  const activeSheet = searchParams.get('sheet')
  const editId = searchParams.get('edit')
  const isSheetOpen = !!(activeSheet || editId)

  // ─── Data fetching ──────────────────────────────────────────────

  const loadEntries = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.getEntries(selectedDate)
      setEntries(data)

      // Check if user has ever logged anything (for first-visit state)
      if (data.length === 0) {
        const today = localDateStr()
        if (selectedDate === today) {
          const allEntries = await api.getEntries()
          setHasEverLogged(allEntries.length > 0)
        }
      } else {
        setHasEverLogged(true)
      }
    } catch (err) {
      if (err instanceof ApiRequestError && err.status === 401) return
      console.error('Failed to load entries:', err)
    }
    setLoading(false)
  }, [selectedDate])

  const loadStreak = useCallback(async () => {
    try {
      const data = await api.getStreak()
      setStreak(data.streak)
    } catch {
      // Ignore — streak is decorative
    }
  }, [])

  useEffect(() => {
    loadEntries()
    loadStreak()
  }, [loadEntries, loadStreak])

  // Load edit entry when editId changes
  useEffect(() => {
    if (editId) {
      const entry = entries.find((e) => e.id === editId)
      setEditEntry(entry || null)
    } else {
      setEditEntry(null)
    }
  }, [editId, entries])

  // ─── Actions ────────────────────────────────────────────────────

  const navigateDate = (direction: -1 | 1) => {
    const d = new Date(selectedDate + 'T12:00:00') // noon to avoid DST edge cases
    d.setDate(d.getDate() + direction)
    const today = localDateStr()
    const newDate = localDateStr(d)
    if (newDate <= today) setSelectedDate(newDate)
  }

  const openSheet = (type: string) => setSearchParams({ sheet: type })
  const openEdit = (id: string) => setSearchParams({ edit: id })
  const closeSheet = () => setSearchParams({})

  const handleSave = async (data: any) => {
    setSaving(true)
    try {
      if (editId && editEntry) {
        await api.updateEntry(editId, data)
        showToast('Updated ✓')
      } else {
        await api.createEntry(data)
        showToast('Saved ✓')
      }
      closeSheet()
      loadEntries()
      loadStreak()
    } catch (err) {
      console.error('Save failed:', err)
      alert(err instanceof Error ? err.message : 'Failed to save. Please try again.')
    }
    setSaving(false)
  }

  const handleDelete = async () => {
    if (!editId) return
    const confirmed = window.confirm('Delete this entry?')
    if (!confirmed) return

    try {
      await api.deleteEntry(editId)
      showToast('Deleted')
      closeSheet()
      loadEntries()
      loadStreak()
    } catch (err) {
      console.error('Delete failed:', err)
      alert('Failed to delete. Please try again.')
    }
  }

  // ─── Render helpers ─────────────────────────────────────────────

  const renderForm = () => {
    const type = editEntry?.type || activeSheet
    const props = {
      onSave: handleSave,
      onDelete: editId ? handleDelete : undefined,
      initialData: editEntry,
      isEdit: !!editId,
    }

    switch (type) {
      case 'meal': return <MealForm {...props} />
      case 'symptom': return <SymptomForm {...props} />
      case 'bowel': return <BowelForm {...props} />
      case 'emotion': return <MoodForm {...props} />
      case 'impact': return <ImpactForm {...props} />
      case 'note': return <NoteForm {...props} />
      default: return null
    }
  }

  const getSheetTitle = () => {
    if (editEntry) return `Edit ${editEntry.type} entry`
    return activeSheet ? SHEET_TITLES[activeSheet] || 'New Entry' : ''
  }

  const getEntryConfig = (type: string) =>
    ENTRY_TYPES.find((t) => t.type === type) || ENTRY_TYPES[5]

  const formatTime = (timestamp: string) => {
    const d = new Date(timestamp)
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  }

  const getEntrySummary = (entry: any): string => {
    switch (entry.type) {
      case 'meal': {
        const foods = (entry.foods as Array<{ name: string }>) || []
        return `${entry.mealType} — ${foods.map((f) => f.name).join(', ')}`
      }
      case 'symptom':
        return `${entry.symptomType} ${entry.severity}/5`
      case 'bowel':
        return `Type ${entry.bristolType}`
      case 'emotion':
        return `Mood ${entry.mood}/5`
      case 'impact':
        return entry.impactSeverity
      case 'note':
        return entry.notes?.slice(0, 60) + (entry.notes?.length > 60 ? '…' : '')
      default:
        return ''
    }
  }

  const today = localDateStr()

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      {/* Date Header */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => navigateDate(-1)}
          className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl hover:bg-stone-100 text-lg"
          aria-label="Previous day"
        >
          ‹
        </button>
        <div className="text-center">
          <h1 className="text-lg font-semibold text-stone-900">
            {formatDate(selectedDate)}
          </h1>
          <p className="text-sm text-stone-500">🌿 Streak: {streak}</p>
        </div>
        <button
          onClick={() => navigateDate(1)}
          disabled={selectedDate === today}
          className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl hover:bg-stone-100 disabled:opacity-30 text-lg"
          aria-label="Next day"
        >
          ›
        </button>
      </div>

      {/* Timeline */}
      <div className="mb-8 min-h-[200px]">
        {loading ? (
          <TimelineSkeleton />
        ) : entries.length === 0 ? (
          <div className="text-center py-12 text-stone-400">
            <p className="text-4xl mb-3">🌿</p>
            {!hasEverLogged ? (
              <>
                <p className="font-medium text-stone-700">Welcome to GutLog!</p>
                <p className="text-sm mt-1">Log your first meal to start tracking</p>
              </>
            ) : (
              <>
                <p className="font-medium">Nothing logged yet today</p>
                <p className="text-sm mt-1">Tap a button below to start tracking</p>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {entries.map((entry) => {
              const config = getEntryConfig(entry.type)
              return (
                <button
                  key={entry.id}
                  onClick={() => openEdit(entry.id)}
                  className="w-full flex items-center gap-3 p-3 bg-white rounded-2xl border border-stone-200 hover:border-green-300 transition-colors text-left"
                >
                  <div className={`w-2.5 h-2.5 rounded-full ${config.dot} flex-shrink-0`} />
                  <span className="text-xs text-stone-400 w-14 flex-shrink-0">
                    {formatTime(entry.timestamp)}
                  </span>
                  <span className="text-sm text-stone-700 flex-1 truncate">
                    {getEntrySummary(entry)}
                  </span>
                  <span className="text-lg flex-shrink-0">{config.emoji}</span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Quick Log Grid */}
      <div className="grid grid-cols-3 gap-3">
        {ENTRY_TYPES.map((entry) => (
          <button
            key={entry.type}
            onClick={() => openSheet(entry.type)}
            className="flex flex-col items-center gap-1.5 p-4 bg-white rounded-2xl border border-stone-200 hover:border-green-400 hover:bg-green-50 transition-colors min-h-[44px]"
          >
            <span className="text-2xl">{entry.emoji}</span>
            <span className="text-xs font-medium text-stone-600">
              {entry.label}
            </span>
          </button>
        ))}
      </div>

      {/* Bottom Sheet */}
      <BottomSheet
        isOpen={isSheetOpen}
        onClose={closeSheet}
        title={getSheetTitle()}
        isDirty={false}
      >
        {renderForm()}
      </BottomSheet>
    </div>
  )
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  const today = localDateStr()
  const yd = new Date()
  yd.setDate(yd.getDate() - 1)
  const yesterday = localDateStr(yd)

  if (dateStr === today) return 'Today'
  if (dateStr === yesterday) return 'Yesterday'

  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

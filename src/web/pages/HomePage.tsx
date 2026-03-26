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
import { CalendarPicker } from '../components/CalendarPicker'

// ─── Entry type config ───────────────────────────────────────────────

const ENTRY_TYPES = [
  { type: 'meal', emoji: '🍽', label: 'Meal', shortLabel: 'Meal', dotFill: '#a8d5a2', dotBorder: '#6db365', labelColor: '#6db365' },
  { type: 'symptom', emoji: '⚡', label: 'Symptom', shortLabel: 'Symptom', dotFill: '#f5c6a0', dotBorder: '#e89b5e', labelColor: '#e89b5e' },
  { type: 'bowel', emoji: '💩', label: 'Bowel Movement', shortLabel: 'BM', dotFill: '#c4b8e0', dotBorder: '#8b7bb8', labelColor: '#8b7bb8' },
  { type: 'emotion', emoji: '💭', label: 'Mood Check', shortLabel: 'Mood', dotFill: '#a0c4f5', dotBorder: '#5e8be8', labelColor: '#5e8be8' },
  { type: 'impact', emoji: '📋', label: 'Daily Impact', shortLabel: 'Impact', dotFill: '#f5a0a0', dotBorder: '#e85e5e', labelColor: '#e85e5e' },
  { type: 'note', emoji: '📝', label: 'Note', shortLabel: 'Note', dotFill: '#e0e0e0', dotBorder: '#999999', labelColor: '#999999' },
] as const

const SHEET_TITLES: Record<string, string> = {
  meal: '🍽 Log Meal',
  symptom: '⚡ Log Symptom',
  bowel: '💩 Log BM',
  emotion: '💭 Log Mood',
  impact: '📋 Log Impact',
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
 * │  🍽  ⚡  💩  💭  📋  📝  │  QuickLogGrid
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
  const [initialLoad, setInitialLoad] = useState(true)
  const [transitioning, setTransitioning] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editEntry, setEditEntry] = useState<any>(null)
  const [hasEverLogged, setHasEverLogged] = useState(true)
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [justAddedId, setJustAddedId] = useState<string | null>(null)

  const activeSheet = searchParams.get('sheet')
  const editId = searchParams.get('edit')
  const isSheetOpen = !!(activeSheet || editId)

  // ─── Data fetching ──────────────────────────────────────────────

  const loadEntries = useCallback(async () => {
    setTransitioning(true)
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
    setInitialLoad(false)
    setTransitioning(false)
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
    if (newDate <= today) {
      setSelectedDate(newDate)
      setJustAddedId(null)
    }
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
        setJustAddedId(editId)
      } else {
        const result = await api.createEntry(data)
        showToast('Saved ✓')
        if (result?.id) setJustAddedId(result.id)
      }
      closeSheet()
      loadEntries()
      loadStreak()

      // Clear the "just added" highlight after 3 seconds
      setTimeout(() => setJustAddedId(null), 3000)
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

  const BRISTOL_LABELS: Record<number, string> = {
    1: 'Hard lumps',
    2: 'Lumpy sausage',
    3: 'Cracked sausage',
    4: 'Smooth & soft',
    5: 'Soft blobs',
    6: 'Mushy',
    7: 'Watery',
  }

  const MOOD_EMOJIS: Record<number, string> = {
    1: '😄', 2: '🙂', 3: '😐', 4: '😞', 5: '😩',
  }

  const getEntryLabel = (entry: any, config: typeof ENTRY_TYPES[number]): string => {
    // Meals show the meal type (Breakfast, Lunch, etc.) instead of generic "Meal"
    if (entry.type === 'meal' && entry.mealType) {
      return entry.mealType
    }
    return config.label
  }

  const getEntrySummary = (entry: any): React.ReactNode => {
    const tag = (text: string) => (
      <span className="inline-block text-[11px] px-1.5 py-0 rounded-[10px] bg-[#f0f0f0] text-[#555] ml-1">{text}</span>
    )

    switch (entry.type) {
      case 'meal': {
        const foods = (entry.foods as Array<{ name: string }>) || []
        return foods.map((f) => f.name).join(', ')
      }
      case 'symptom':
        return <>{entry.symptomType} {tag(`${entry.severity}/5`)}</>
      case 'bowel': {
        const label = BRISTOL_LABELS[entry.bristolType] || ''
        const urgencyLabel = entry.urgency || 'No urgency'
        return <>Type {entry.bristolType}{label ? ` (${label})` : ''} {tag(urgencyLabel)}</>
      }
      case 'emotion': {
        const emoji = MOOD_EMOJIS[entry.mood] || ''
        const notesText = entry.notes ? entry.notes.slice(0, 50) : ''
        return notesText ? `${notesText} ${emoji}` : `Mood ${entry.mood}/5 ${emoji}`
      }
      case 'impact': {
        const desc = entry.description ? entry.description.slice(0, 50) : ''
        return desc
          ? <>{desc} {tag(entry.impactSeverity)}</>
          : <>{entry.impactSeverity}</>
      }
      case 'note':
        return entry.notes?.slice(0, 60) + (entry.notes?.length > 60 ? '…' : '')
      default:
        return ''
    }
  }

  const today = localDateStr()

  return (
    <div className="max-w-lg mx-auto px-4 py-4">
      {/* Date Header */}
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={() => navigateDate(-1)}
          className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-[#f5f5f5] text-lg text-[#767676]"
          aria-label="Previous day"
        >
          ‹
        </button>
        <button
          onClick={() => setCalendarOpen((o) => !o)}
          className="text-center cursor-pointer hover:bg-[#fafaf9] rounded-lg px-3 py-1.5 transition-colors"
          aria-label="Open calendar picker"
          aria-expanded={calendarOpen}
        >
          <h1 className="text-lg font-semibold text-[#333]">
            {formatDayLabel(selectedDate)}{' '}
            <span className="text-xs font-semibold text-[#4a7c59]" title="Streak">🌿 {streak}</span>
          </h1>
          <div className="text-xs text-[#767676]">
            {formatFullDate(selectedDate)}
            <span className="ml-1 text-[#767676]">{calendarOpen ? '▲' : '▼'}</span>
          </div>
        </button>
        <button
          onClick={() => navigateDate(1)}
          disabled={selectedDate === today}
          className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-[#f5f5f5] disabled:opacity-30 text-lg text-[#767676]"
          aria-label="Next day"
        >
          ›
        </button>
      </div>

      {/* Calendar Date Picker Dropdown */}
      {calendarOpen && (
        <CalendarPicker
          selectedDate={selectedDate}
          onSelectDate={(date) => {
            setSelectedDate(date)
            setCalendarOpen(false)
          }}
          onClose={() => setCalendarOpen(false)}
        />
      )}

      {/* Timeline */}
      <div className={`mb-3 min-h-[200px] transition-opacity duration-150 ${transitioning && !initialLoad ? 'opacity-60' : 'opacity-100'}`}>
        {initialLoad ? (
          <TimelineSkeleton />
        ) : entries.length === 0 && !transitioning ? (
          <div className="text-center py-12 text-[#999]">
            <p className="text-4xl mb-3">🌿</p>
            {!hasEverLogged ? (
              <>
                <p className="font-medium text-[#555]">Welcome to GutLog!</p>
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
          <div className="relative pl-7">
            {/* Vertical timeline line */}
            <div className="absolute left-[9px] top-0 bottom-0 w-0.5 bg-[#e0e0e0]" />

            {entries.map((entry) => {
              const config = getEntryConfig(entry.type)
              const isJustAdded = entry.id === justAddedId
              return (
                <button
                  key={entry.id}
                  onClick={() => openEdit(entry.id)}
                  className={`relative w-full mb-3.5 px-2.5 py-2.5 bg-[#fefefe] rounded-lg border transition-colors text-left ${
                    isJustAdded
                      ? 'border-[#4a7c59] shadow-just-added animate-entry-fade-in'
                      : 'border-[#e8e8e8] hover:border-[#a3c4a9]'
                  }`}
                >
                  {/* Timeline dot */}
                  <div
                    className="absolute -left-[22px] top-3.5 w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: config.dotFill, border: `2px solid ${config.dotBorder}` }}
                  />

                  {/* Time */}
                  <div className="text-[11px] text-[#767676] mb-0.5">
                    {formatTime(entry.timestamp)}
                  </div>

                  {/* Entry type label */}
                  <div
                    className="text-[10px] uppercase tracking-wide font-semibold mb-0.5"
                    style={{ color: config.labelColor }}
                  >
                    {config.emoji} {getEntryLabel(entry, config)}
                    {isJustAdded && (
                      <span className="ml-1.5 text-[#4a7c59] normal-case tracking-normal">· ✨ just added</span>
                    )}
                  </div>

                  {/* Content */}
                  <div className="text-[13px] text-[#333] truncate">
                    {getEntrySummary(entry)}
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Quick Log Grid */}
      <h3 className="text-[13px] font-semibold text-[#666] mt-4 mb-1.5">Quick Log</h3>
      <div className="grid grid-cols-3 gap-2">
        {ENTRY_TYPES.map((entry) => (
          <button
            key={entry.type}
            onClick={() => openSheet(entry.type)}
            className="flex flex-col items-center gap-1 px-2 py-3 bg-white rounded-[10px] border border-[#ddd] hover:border-[#4a7c59] hover:bg-[#f0f7f0] transition-colors min-h-[56px] min-w-[56px]"
          >
            <span className="text-2xl">{entry.emoji}</span>
            <span className="text-xs font-medium text-[#666]">
              {entry.shortLabel}
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

function formatDayLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  const today = localDateStr()
  const yd = new Date()
  yd.setDate(yd.getDate() - 1)
  const yesterday = localDateStr(yd)

  if (dateStr === today) return 'Today'
  if (dateStr === yesterday) return 'Yesterday'

  return d.toLocaleDateString('en-US', { weekday: 'long' })
}

function formatFullDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

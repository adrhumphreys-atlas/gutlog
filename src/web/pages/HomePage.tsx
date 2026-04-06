import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
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

// Entry type colors use CSS variable names so they work in both light and dark mode
const ENTRY_TYPES = [
  { type: 'meal', emoji: '🍽', label: 'Meal', shortLabel: 'Meal', dotFillVar: '--dot-meal', dotBorderVar: '--dot-meal-accent', labelColorVar: '--dot-meal-accent' },
  { type: 'symptom', emoji: '⚡', label: 'Symptom', shortLabel: 'Symptom', dotFillVar: '--dot-symptom', dotBorderVar: '--dot-symptom-accent', labelColorVar: '--dot-symptom-accent' },
  { type: 'bowel', emoji: '💩', label: 'Bowel Movement', shortLabel: 'BM', dotFillVar: '--dot-bowel', dotBorderVar: '--dot-bowel-accent', labelColorVar: '--dot-bowel-accent' },
  { type: 'emotion', emoji: '💭', label: 'Mood Check', shortLabel: 'Mood', dotFillVar: '--dot-emotion', dotBorderVar: '--dot-emotion-accent', labelColorVar: '--dot-emotion-accent' },
  { type: 'impact', emoji: '📋', label: 'Daily Impact', shortLabel: 'Impact', dotFillVar: '--dot-impact', dotBorderVar: '--dot-impact-accent', labelColorVar: '--dot-impact-accent' },
  { type: 'note', emoji: '📝', label: 'Note', shortLabel: 'Note', dotFillVar: '--dot-note', dotBorderVar: '--dot-note-accent', labelColorVar: '--dot-note-accent' },
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
  const [streakHeatmapOpen, setStreakHeatmapOpen] = useState(false)
  const [loggedDates, setLoggedDates] = useState<Set<string>>(new Set())
  const [activeExperiment, setActiveExperiment] = useState<{ id: string; name: string; eliminatedFoods: string[]; startDate: string; durationDays: number } | null>(null)

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

  const loadLoggedDates = useCallback(async () => {
    try {
      const now = new Date()
      const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
      const lastMonth = now.getMonth() === 0
        ? `${now.getFullYear() - 1}-12`
        : `${now.getFullYear()}-${String(now.getMonth()).padStart(2, '0')}`
      const [thisData, lastData] = await Promise.all([
        api.getEntryDates(thisMonth),
        api.getEntryDates(lastMonth),
      ])
      setLoggedDates(new Set([...thisData.dates, ...lastData.dates]))
    } catch {
      // Non-critical
    }
  }, [])

  const toggleStreakHeatmap = () => {
    if (!streakHeatmapOpen && loggedDates.size === 0) {
      loadLoggedDates()
    }
    setStreakHeatmapOpen((o) => !o)
  }

  const loadActiveExperiment = useCallback(async () => {
    try {
      const experiments = await api.getExperiments()
      const now = Date.now()
      const active = experiments
        .filter((e: any) => e.status === 'active' && (!e.endDate || new Date(e.endDate).getTime() >= now))
        .sort((a: any, b: any) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())
      setActiveExperiment(active[0] ?? null)
    } catch {
      // Non-critical — banner is informational
    }
  }, [])

  useEffect(() => {
    loadEntries()
    loadStreak()
    loadActiveExperiment()
  }, [loadEntries, loadStreak, loadActiveExperiment])

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
      showToast(err instanceof Error ? err.message : 'Failed to save. Please try again.', 'error')
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
      showToast('Failed to delete. Please try again.', 'error')
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
      <span className="inline-block text-[11px] px-1.5 py-0 rounded-[10px] bg-[var(--bg-muted)] text-[var(--text-secondary)] ml-1">{text}</span>
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
          className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-[var(--bg-hover-strong)] text-lg text-[var(--text-muted)]"
          aria-label="Previous day"
        >
          ‹
        </button>
        <button
          onClick={() => setCalendarOpen((o) => !o)}
          className="text-center cursor-pointer hover:bg-[var(--bg-hover)] rounded-lg px-3 py-1.5 transition-colors"
          aria-label="Open calendar picker"
          aria-expanded={calendarOpen}
        >
          <h1 className="text-lg font-semibold text-[var(--text-primary)]">
            {formatDayLabel(selectedDate)}{' '}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); toggleStreakHeatmap() }}
              className="text-xs font-semibold text-[var(--green-primary)] hover:underline"
              aria-label={`Streak: ${streak} days. Tap to see your logging history.`}
              aria-expanded={streakHeatmapOpen}
            >
              🌿 {streak}
            </button>
          </h1>
          <div className="text-xs text-[var(--text-muted)]">
            {formatFullDate(selectedDate)}
            <span className="ml-1 text-[var(--text-muted)]">{calendarOpen ? '▲' : '▼'}</span>
          </div>
        </button>
        <button
          onClick={() => navigateDate(1)}
          disabled={selectedDate === today}
          className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-[var(--bg-hover-strong)] disabled:opacity-30 text-lg text-[var(--text-muted)]"
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

      {/* Active Experiment Banner */}
      {activeExperiment && (
        <ActiveExperimentBanner experiment={activeExperiment} />
      )}

      {/* Streak Heatmap Popover */}
      {streakHeatmapOpen && (
        <StreakHeatmap
          streak={streak}
          loggedDates={loggedDates}
          onClose={() => setStreakHeatmapOpen(false)}
        />
      )}

      {/* Timeline */}
      <div className={`mb-3 min-h-[200px] transition-opacity duration-150 ${transitioning && !initialLoad ? 'opacity-60' : 'opacity-100'}`}>
        {initialLoad ? (
          <TimelineSkeleton />
        ) : entries.length === 0 && !transitioning ? (
          <div className="text-center py-12 text-[var(--text-hint)]">
            <p className="text-4xl mb-3">🌿</p>
            {!hasEverLogged ? (
              <>
                <p className="font-medium text-[var(--text-secondary)]">Welcome to GutLog!</p>
                <p className="text-sm mt-1">Log your first meal to start tracking</p>
                <OnboardingTip />
              </>
            ) : (
              <>
                <p className="font-medium text-[var(--text-secondary)]">Nothing logged yet today</p>
                <p className="text-sm mt-1">Tap a button below to start tracking</p>
              </>
            )}
          </div>
        ) : (
          <div className="relative pl-7">
            {/* Vertical timeline line */}
            <div className="absolute left-[9px] top-0 bottom-0 w-0.5 bg-[var(--border-timeline)]" />

            {entries.map((entry) => {
              const config = getEntryConfig(entry.type)
              const isJustAdded = entry.id === justAddedId
              return (
                <button
                  key={entry.id}
                  onClick={() => openEdit(entry.id)}
                  className={`relative w-full mb-3.5 px-2.5 py-2.5 bg-[var(--bg-timeline-item)] rounded-lg border transition-colors text-left ${
                    isJustAdded
                      ? 'border-[var(--green-primary)] shadow-just-added animate-entry-fade-in'
                      : 'border-[var(--border-card)] hover:border-[var(--green-primary)]/50'
                  }`}
                >
                  {/* Timeline dot */}
                  <div
                    className="absolute -left-[22px] top-3.5 w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: `var(${config.dotFillVar})`, border: `2px solid var(${config.dotBorderVar})` }}
                  />

                  {/* Time */}
                  <div className="text-[11px] text-[var(--text-muted)] mb-0.5">
                    {formatTime(entry.timestamp)}
                  </div>

                  {/* Entry type label */}
                  <div
                    className="text-[10px] uppercase tracking-wide font-semibold mb-0.5"
                    style={{ color: `var(${config.labelColorVar})` }}
                  >
                    {config.emoji} {getEntryLabel(entry, config)}
                    {isJustAdded && (
                      <span className="ml-1.5 text-[var(--green-primary)] normal-case tracking-normal">· ✨ just added</span>
                    )}
                  </div>

                  {/* Content */}
                  <div className="text-[13px] text-[var(--text-primary)] truncate">
                    {getEntrySummary(entry)}
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Quick Log Grid */}
      <h3 className="text-[13px] font-semibold text-[var(--text-label)] mt-4 mb-1.5">Quick Log</h3>
      <div className="grid grid-cols-3 gap-2">
        {ENTRY_TYPES.map((entry) => (
          <button
            key={entry.type}
            onClick={() => openSheet(entry.type)}
            className="flex flex-col items-center gap-1 px-2 py-3 bg-[var(--bg-card)] rounded-[10px] border border-[var(--border-default)] hover:border-[var(--green-primary)] hover:bg-[var(--green-light)] transition-colors min-h-[56px] min-w-[56px]"
          >
            <span className="text-2xl">{entry.emoji}</span>
            <span className="text-xs font-medium text-[var(--text-label)]">
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

// ─── Active Experiment Banner ────────────────────────────────────────────────

interface ActiveExperimentBannerProps {
  experiment: {
    id: string
    name: string
    eliminatedFoods: string[]
    startDate: string
    durationDays: number
  }
}

function ActiveExperimentBanner({ experiment }: ActiveExperimentBannerProps) {
  const navigate = useNavigate()
  const start = new Date(experiment.startDate)
  const today = new Date()
  const dayNumber = Math.floor((today.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1
  const dayStr = `Day ${Math.min(dayNumber, experiment.durationDays)} of ${experiment.durationDays}`

  // Show up to 4 eliminated foods then "& N more"
  const foods = experiment.eliminatedFoods
  const shown = foods.slice(0, 4)
  const rest = foods.length - shown.length
  const foodStr = rest > 0 ? `${shown.join(', ')} & ${rest} more` : shown.join(', ')

  return (
    <button
      onClick={() => navigate(`/experiments/${experiment.id}`)}
      className="w-full mb-3 text-left border-2 border-[var(--experiment-border)] bg-[var(--experiment-bg)] rounded-[10px] px-3 py-2.5 hover:bg-[var(--green-light)] transition-colors"
      aria-label={`Active experiment: ${experiment.name}. ${dayStr}. Tap to view details.`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-base shrink-0">🔬</span>
          <div className="min-w-0">
            <div className="text-[12px] font-semibold text-[var(--green-primary)] truncate">
              {experiment.name}
              <span className="ml-1.5 text-[10px] font-normal text-[var(--text-muted)]">{dayStr}</span>
            </div>
            {foodStr && (
              <div className="text-[11px] text-[var(--text-secondary)] truncate">
                Avoid: {foodStr}
              </div>
            )}
          </div>
        </div>
        <span className="text-[var(--text-muted)] text-sm shrink-0 ml-2">›</span>
      </div>
    </button>
  )
}

// ─── Onboarding Tip ─────────────────────────────────────────────────────────

function OnboardingTip() {
  const STORAGE_KEY = 'gutlog_onboarding_dismissed'
  const [visible, setVisible] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) !== 'true'
    } catch {
      return true
    }
  })

  const dismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY, 'true')
    } catch {}
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="mt-5 mx-auto max-w-xs text-left bg-[var(--green-light)] border border-[var(--green-primary)]/30 rounded-[10px] p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[13px] font-semibold text-[var(--green-primary)] mb-1">
            How GutLog works
          </p>
          <ol className="text-[12px] text-[var(--text-secondary)] space-y-1 list-none">
            <li>1️⃣ <span className="font-medium">Log daily</span> — meals, symptoms, mood, bowel movements</li>
            <li>2️⃣ <span className="font-medium">Wait 7+ days</span> — the more you log, the clearer the picture</li>
            <li>3️⃣ <span className="font-medium">Check Insights</span> — discover what's affecting your gut</li>
          </ol>
        </div>
        <button
          onClick={dismiss}
          className="text-[var(--text-muted)] hover:text-[var(--text-primary)] text-lg leading-none shrink-0 w-5 h-5 flex items-center justify-center mt-0.5"
          aria-label="Dismiss onboarding tip"
        >
          ×
        </button>
      </div>
    </div>
  )
}

// ─── Streak Heatmap ──────────────────────────────────────────────────────────

interface StreakHeatmapProps {
  streak: number
  loggedDates: Set<string>
  onClose: () => void
}

function StreakHeatmap({ streak, loggedDates, onClose }: StreakHeatmapProps) {
  // Build last 35 days (5 rows × 7 cols) ending today
  const today = localDateStr()
  const days: string[] = []
  for (let i = 34; i >= 0; i--) {
    const d = new Date(today + 'T12:00:00')
    d.setDate(d.getDate() - i)
    days.push(localDateStr(d))
  }

  // Day-of-week labels
  const DOW = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

  return (
    <div
      className="mb-3 p-3 bg-[var(--bg-card)] border border-[var(--border-card)] rounded-[10px] shadow-sm"
      role="region"
      aria-label="Logging history heatmap"
    >
      <div className="flex items-center justify-between mb-2">
        <div>
          <span className="text-[13px] font-semibold text-[var(--text-primary)]">
            🌿 {streak}-day streak
          </span>
          <span className="ml-2 text-[11px] text-[var(--text-muted)]">
            {loggedDates.size} days logged (last 2 months)
          </span>
        </div>
        <button
          onClick={onClose}
          className="text-[var(--text-muted)] hover:text-[var(--text-primary)] text-lg leading-none w-6 h-6 flex items-center justify-center"
          aria-label="Close streak heatmap"
        >
          ×
        </button>
      </div>

      {/* Day-of-week header */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {DOW.map((d) => (
          <div key={d} className="text-center text-[9px] text-[var(--text-muted)] font-medium">
            {d}
          </div>
        ))}
      </div>

      {/* 5-week grid */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((date) => {
          const isLogged = loggedDates.has(date)
          const isToday = date === today
          return (
            <div
              key={date}
              title={date}
              className={`aspect-square rounded-sm ${
                isToday
                  ? isLogged
                    ? 'bg-[var(--green-primary)] ring-2 ring-[var(--green-primary)] ring-offset-1 ring-offset-[var(--bg-card)]'
                    : 'ring-2 ring-[var(--green-primary)] ring-offset-1 ring-offset-[var(--bg-card)] bg-[var(--bg-muted)]'
                  : isLogged
                    ? 'bg-[var(--green-primary)] opacity-80'
                    : 'bg-[var(--bg-muted)]'
              }`}
              aria-label={`${date}: ${isLogged ? 'logged' : 'not logged'}`}
            />
          )
        })}
      </div>

      <div className="flex items-center gap-2 mt-2 text-[10px] text-[var(--text-muted)]">
        <span className="flex items-center gap-1">
          <span className="inline-block w-2.5 h-2.5 rounded-sm bg-[var(--bg-muted)]" /> No log
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-2.5 h-2.5 rounded-sm bg-[var(--green-primary)] opacity-80" /> Logged
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-2.5 h-2.5 rounded-sm bg-[var(--green-primary)] ring-2 ring-[var(--green-primary)] ring-offset-1 ring-offset-[var(--bg-card)]" /> Today
        </span>
      </div>
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

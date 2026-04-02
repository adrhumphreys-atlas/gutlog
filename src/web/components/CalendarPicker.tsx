import { useState, useEffect, useRef, useCallback } from 'react'
import { api } from '../lib/api'

interface CalendarPickerProps {
  /** Currently selected date in YYYY-MM-DD format */
  selectedDate: string
  /** Called when a date is tapped */
  onSelectDate: (date: string) => void
  /** Called when the picker should close (outside click, etc.) */
  onClose: () => void
}

/** Return YYYY-MM-DD for a Date, treating it as local. */
function toDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Return today's YYYY-MM-DD in local timezone. */
function todayStr(): string {
  return toDateStr(new Date())
}

/** Return YYYY-MM for a year and month (1-indexed). */
function toMonthStr(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`
}

/**
 * CalendarPicker — month-grid dropdown for jumping to a date.
 *
 * ┌───────────────────────────┐
 * │  ‹    March 2026     ›   │
 * │  M  T  W  T  F  S  S    │
 * │  ..  1  2● 3● 4● ...    │
 * │  ... 25⬤ 26 27 ...      │
 * │  ● = days with entries   │
 * └───────────────────────────┘
 */
export function CalendarPicker({ selectedDate, onSelectDate, onClose }: CalendarPickerProps) {
  const today = todayStr()

  // Calendar view month — initialise to the month of the selected date
  const [viewYear, setViewYear] = useState(() => {
    const [y] = selectedDate.split('-').map(Number)
    return y
  })
  const [viewMonth, setViewMonth] = useState(() => {
    const [, m] = selectedDate.split('-').map(Number)
    return m
  })

  // Set of YYYY-MM-DD strings that have entries
  const [entryDates, setEntryDates] = useState<Set<string>>(new Set())
  const [loadingDates, setLoadingDates] = useState(false)

  const containerRef = useRef<HTMLDivElement>(null)

  // ─── Fetch entry dates for the viewed month ─────────────────────

  const fetchEntryDates = useCallback(async (year: number, month: number) => {
    setLoadingDates(true)
    try {
      const data = await api.getEntryDates(toMonthStr(year, month))
      setEntryDates(new Set(data.dates))
    } catch {
      // Non-critical — calendar still works without dots
      setEntryDates(new Set())
    }
    setLoadingDates(false)
  }, [])

  useEffect(() => {
    fetchEntryDates(viewYear, viewMonth)
  }, [viewYear, viewMonth, fetchEntryDates])

  // ─── Close on outside click ─────────────────────────────────────

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        // Don't close if the click is on the date header toggle — let it handle its own toggle
        const target = e.target as HTMLElement
        if (target.closest('[aria-label="Open calendar picker"]')) return
        onClose()
      }
    }
    // Use setTimeout so the click that opened the picker doesn't immediately close it
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClick)
    }, 0)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('mousedown', handleClick)
    }
  }, [onClose])

  // ─── Month navigation ──────────────────────────────────────────

  const goToPrevMonth = () => {
    if (viewMonth === 1) {
      setViewYear(viewYear - 1)
      setViewMonth(12)
    } else {
      setViewMonth(viewMonth - 1)
    }
  }

  const goToNextMonth = () => {
    const [todayY, todayM] = today.split('-').map(Number)
    // Don't allow navigating past the current month
    if (viewYear === todayY && viewMonth === todayM) return

    if (viewMonth === 12) {
      setViewYear(viewYear + 1)
      setViewMonth(1)
    } else {
      setViewMonth(viewMonth + 1)
    }
  }

  const isNextDisabled = (() => {
    const [todayY, todayM] = today.split('-').map(Number)
    return viewYear === todayY && viewMonth === todayM
  })()

  // ─── Build calendar grid ───────────────────────────────────────

  // First day of the month (0 = Sunday, adjust to Monday-start)
  const firstOfMonth = new Date(viewYear, viewMonth - 1, 1)
  const startDow = firstOfMonth.getDay() // 0=Sun
  // Convert to Monday-start: Mon=0, Tue=1, ..., Sun=6
  const startOffset = startDow === 0 ? 6 : startDow - 1

  // Days in this month
  const daysInMonth = new Date(viewYear, viewMonth, 0).getDate()

  // Days in the previous month (for leading grey cells)
  const daysInPrevMonth = new Date(viewYear, viewMonth - 1, 0).getDate()

  // Build cells
  type DayCell = {
    day: number
    dateStr: string
    isCurrentMonth: boolean
    isToday: boolean
    isSelected: boolean
    hasEntries: boolean
    isFuture: boolean
  }

  const cells: DayCell[] = []

  // Leading days from previous month
  for (let i = startOffset - 1; i >= 0; i--) {
    const day = daysInPrevMonth - i
    const prevMonth = viewMonth === 1 ? 12 : viewMonth - 1
    const prevYear = viewMonth === 1 ? viewYear - 1 : viewYear
    const dateStr = `${prevYear}-${String(prevMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    cells.push({
      day,
      dateStr,
      isCurrentMonth: false,
      isToday: dateStr === today,
      isSelected: dateStr === selectedDate,
      hasEntries: entryDates.has(dateStr),
      isFuture: dateStr > today,
    })
  }

  // Current month days
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${viewYear}-${String(viewMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    cells.push({
      day,
      dateStr,
      isCurrentMonth: true,
      isToday: dateStr === today,
      isSelected: dateStr === selectedDate,
      hasEntries: entryDates.has(dateStr),
      isFuture: dateStr > today,
    })
  }

  // Trailing days to fill last row
  const remaining = cells.length % 7 === 0 ? 0 : 7 - (cells.length % 7)
  for (let i = 1; i <= remaining; i++) {
    const nextMonth = viewMonth === 12 ? 1 : viewMonth + 1
    const nextYear = viewMonth === 12 ? viewYear + 1 : viewYear
    const dateStr = `${nextYear}-${String(nextMonth).padStart(2, '0')}-${String(i).padStart(2, '0')}`
    cells.push({
      day: i,
      dateStr,
      isCurrentMonth: false,
      isToday: dateStr === today,
      isSelected: dateStr === selectedDate,
      hasEntries: entryDates.has(dateStr),
      isFuture: dateStr > today,
    })
  }

  const handleSelectDate = (cell: DayCell) => {
    if (cell.isFuture) return
    onSelectDate(cell.dateStr)
  }

  const monthLabel = new Date(viewYear, viewMonth - 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  })

  // ─── Render ────────────────────────────────────────────────────

  return (
    <div
      ref={containerRef}
      className="border border-[var(--border-default)] rounded-[10px] p-3 bg-[var(--bg-card)] shadow-lg mb-3 animate-in fade-in slide-in-from-top-2 duration-200"
    >
      {/* Month header with navigation */}
      <div className="flex items-center justify-between mb-2">
        <button
          onClick={goToPrevMonth}
          className="p-1 min-w-[32px] min-h-[32px] flex items-center justify-center rounded-lg hover:bg-[var(--bg-hover-strong)] text-sm text-[var(--text-muted)]"
          aria-label="Previous month"
        >
          ‹
        </button>
        <span className="text-[13px] font-semibold text-[var(--text-primary)]">{monthLabel}</span>
        <button
          onClick={goToNextMonth}
          disabled={isNextDisabled}
          className="p-1 min-w-[32px] min-h-[32px] flex items-center justify-center rounded-lg hover:bg-[var(--bg-hover-strong)] disabled:opacity-30 text-sm text-[var(--text-muted)]"
          aria-label="Next month"
        >
          ›
        </button>
      </div>

      {/* Day-of-week labels */}
      <div className="grid grid-cols-7 gap-0.5 text-center mb-0.5">
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((label, i) => (
          <div key={i} className="text-[10px] font-semibold text-[var(--text-hint)] py-1">
            {label}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-0.5 text-center">
        {cells.map((cell, i) => {
          const base = 'relative flex flex-col items-center justify-center rounded-md text-xs min-h-[36px] cursor-pointer transition-colors'
          const muted = !cell.isCurrentMonth ? 'text-[var(--text-hint)]' : 'text-[var(--text-primary)]'
          const future = cell.isFuture ? 'text-[var(--text-hint)] cursor-default' : ''
          const todayCls = cell.isToday ? 'bg-[var(--green-light)] font-bold text-[var(--green-primary)]' : ''
          const selectedCls = cell.isSelected && !cell.isToday ? 'bg-[var(--green-light)] font-semibold' : ''
          const hoverCls = !cell.isFuture && cell.isCurrentMonth ? 'hover:bg-[var(--bg-hover)]' : ''

          return (
            <button
              key={i}
              onClick={() => handleSelectDate(cell)}
              disabled={cell.isFuture}
              className={`${base} ${muted} ${future} ${todayCls} ${selectedCls} ${hoverCls}`}
              aria-label={cell.dateStr}
            >
              <span>{cell.day || ''}</span>
              {cell.hasEntries && (
                <span className="text-[var(--green-primary)] text-[5px] leading-none mt-px">●</span>
              )}
            </button>
          )
        })}
      </div>

      {/* Legend */}
      <div className="text-[11px] text-[var(--text-hint)] mt-2 text-center">
        ● = days with entries · Tap a date to jump
      </div>
    </div>
  )
}

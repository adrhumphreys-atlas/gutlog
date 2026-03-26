import { useMemo } from 'react'

interface DateTimeFieldProps {
  /** ISO 8601 UTC timestamp */
  value: string
  /** Called with a new ISO 8601 UTC timestamp */
  onChange: (isoTimestamp: string) => void
}

/**
 * Converts a UTC ISO timestamp to a `datetime-local` input value
 * in the user's local timezone (YYYY-MM-DDTHH:MM).
 */
function toLocalDateTimeValue(isoUtc: string): string {
  const d = new Date(isoUtc)
  const y = d.getFullYear()
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const h = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${y}-${mo}-${day}T${h}:${min}`
}

/**
 * Converts a `datetime-local` value (local timezone) back to a UTC ISO string.
 */
function fromLocalDateTimeValue(localValue: string): string {
  return new Date(localValue).toISOString()
}

/**
 * Returns the current local datetime as a max value for the input
 * (with a 5-minute grace to match backend validation).
 */
function maxDateTimeValue(): string {
  const d = new Date(Date.now() + 5 * 60 * 1000)
  return toLocalDateTimeValue(d.toISOString())
}

/**
 * DateTimeField — allows users to change the date & time of an entry.
 * Uses native datetime-local input for good mobile UX.
 */
export function DateTimeField({ value, onChange }: DateTimeFieldProps) {
  const localValue = useMemo(() => toLocalDateTimeValue(value), [value])
  const max = useMemo(() => maxDateTimeValue(), [])

  return (
    <div>
      <label className="block text-xs font-semibold text-[#666] mb-1">
        Date & time
      </label>
      <input
        type="datetime-local"
        value={localValue}
        max={max}
        onChange={(e) => {
          if (e.target.value) {
            onChange(fromLocalDateTimeValue(e.target.value))
          }
        }}
        className="w-full px-2.5 py-2 rounded-md border border-[#ddd] focus:border-[#4a7c59] focus:ring-2 focus:ring-[#4a7c59]/15 outline-none text-sm bg-white min-h-[44px]"
      />
    </div>
  )
}

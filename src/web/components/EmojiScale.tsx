interface EmojiScaleOption {
  value: number
  emoji: string
  label: string
}

interface EmojiScaleProps {
  options: EmojiScaleOption[]
  value: number | null
  onChange: (value: number) => void
  label: string
}

/**
 * EmojiScale — Horizontal picker with selectable emoji options.
 *
 * Used for: severity (1-5), mood (1-5), Bristol stool scale (1-7),
 * stress (1-5), sleep quality (1-5), anxiety (1-5).
 *
 * Accessibility: ARIA radiogroup with aria-label per option,
 * 44px minimum touch targets.
 */
export function EmojiScale({ options, value, onChange, label }: EmojiScaleProps) {
  return (
    <div>
      <span className="block text-sm font-medium text-stone-700 mb-2">
        {label}
      </span>
      <div
        role="radiogroup"
        aria-label={label}
        className="flex gap-1.5 flex-wrap"
      >
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={value === opt.value}
            aria-label={`${opt.label} (${opt.value})`}
            onClick={() => onChange(opt.value)}
            className={`flex flex-col items-center gap-0.5 p-2 min-w-[44px] min-h-[44px] rounded-xl border-2 transition-colors ${
              value === opt.value
                ? 'border-green-400 bg-green-50'
                : 'border-transparent hover:bg-stone-50'
            }`}
          >
            <span className="text-xl">{opt.emoji}</span>
            <span className="text-[10px] text-stone-500 leading-tight">
              {opt.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Predefined scales (from DESIGN.md) ──────────────────────────────

export const SEVERITY_SCALE: EmojiScaleOption[] = [
  { value: 1, emoji: '😊', label: 'Minimal' },
  { value: 2, emoji: '😐', label: 'Mild' },
  { value: 3, emoji: '😕', label: 'Moderate' },
  { value: 4, emoji: '😣', label: 'Severe' },
  { value: 5, emoji: '😫', label: 'Extreme' },
]

export const MOOD_SCALE: EmojiScaleOption[] = [
  { value: 1, emoji: '😢', label: 'Awful' },
  { value: 2, emoji: '😕', label: 'Low' },
  { value: 3, emoji: '😐', label: 'Okay' },
  { value: 4, emoji: '😊', label: 'Good' },
  { value: 5, emoji: '😄', label: 'Great' },
]

export const BRISTOL_SCALE: EmojiScaleOption[] = [
  { value: 1, emoji: '🪨', label: 'Hard' },
  { value: 2, emoji: '🥜', label: 'Lumpy' },
  { value: 3, emoji: '🌽', label: 'Cracked' },
  { value: 4, emoji: '🍌', label: 'Smooth' },
  { value: 5, emoji: '🫧', label: 'Soft' },
  { value: 6, emoji: '☁️', label: 'Mushy' },
  { value: 7, emoji: '💧', label: 'Watery' },
]

export const STRESS_SCALE: EmojiScaleOption[] = [
  { value: 1, emoji: '😌', label: 'None' },
  { value: 2, emoji: '😐', label: 'Mild' },
  { value: 3, emoji: '😟', label: 'Moderate' },
  { value: 4, emoji: '😰', label: 'High' },
  { value: 5, emoji: '🤯', label: 'Extreme' },
]

export const SLEEP_SCALE: EmojiScaleOption[] = [
  { value: 1, emoji: '😵', label: 'Terrible' },
  { value: 2, emoji: '😴', label: 'Poor' },
  { value: 3, emoji: '😐', label: 'Okay' },
  { value: 4, emoji: '😊', label: 'Good' },
  { value: 5, emoji: '🌟', label: 'Great' },
]

import { useState, useEffect } from 'react'
import { api } from '../../lib/api'

interface MealFormProps {
  onSave: (data: any) => void
  onDelete?: () => void
  initialData?: any
  isEdit?: boolean
}

const MEAL_TYPES = [
  { value: 'breakfast', emoji: '🌅', label: 'Breakfast' },
  { value: 'lunch', emoji: '☀️', label: 'Lunch' },
  { value: 'dinner', emoji: '🌙', label: 'Dinner' },
  { value: 'supper', emoji: '🌃', label: 'Supper' },
  { value: 'snack', emoji: '🍿', label: 'Snack' },
]

const PORTIONS = [
  { value: 'small', emoji: '🤏', label: 'Small' },
  { value: 'normal', emoji: '👌', label: 'Normal' },
  { value: 'large', emoji: '🤲', label: 'Large' },
  { value: 'huge', emoji: '🍽️', label: 'Huge' },
]

function guessMealType(): string {
  const hour = new Date().getHours()
  if (hour >= 5 && hour < 10) return 'breakfast'
  if (hour >= 10 && hour < 14) return 'lunch'
  if (hour >= 14 && hour < 17) return 'snack'
  if (hour >= 17 && hour < 21) return 'dinner'
  return 'supper' // 21:00–04:59
}

export function MealForm({ onSave, onDelete, initialData, isEdit }: MealFormProps) {
  const [mealType, setMealType] = useState(initialData?.mealType || guessMealType())
  const [foods, setFoods] = useState<string[]>(
    initialData?.foods?.map((f: any) => f.name) || ['']
  )
  const [portionSize, setPortionSize] = useState(initialData?.portionSize || 'normal')
  const [notes, setNotes] = useState(initialData?.notes || '')
  const [foodInput, setFoodInput] = useState('')
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [recentFoods, setRecentFoods] = useState<string[]>([])

  // Load recent foods on mount
  useEffect(() => {
    api.getRecentFoods().then((r) => setRecentFoods(r.recent)).catch(() => {})
  }, [])

  // Autocomplete
  useEffect(() => {
    if (foodInput.length < 2) {
      setSuggestions([])
      return
    }
    const timer = setTimeout(() => {
      api.getFoodAutocomplete(foodInput).then((r) => setSuggestions(r.suggestions)).catch(() => {})
    }, 200)
    return () => clearTimeout(timer)
  }, [foodInput])

  const addFood = (name: string) => {
    if (name.trim() && !foods.includes(name.trim())) {
      setFoods((prev) => [...prev.filter(Boolean), name.trim()])
    }
    setFoodInput('')
    setSuggestions([])
  }

  const removeFood = (index: number) => {
    setFoods((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = () => {
    // Auto-add any text sitting in the input so users don't lose it
    let allFoods = [...foods.filter(Boolean)]
    if (foodInput.trim() && !allFoods.includes(foodInput.trim())) {
      allFoods.push(foodInput.trim())
      setFoodInput('')
    }

    if (!mealType || allFoods.length === 0) return

    onSave({
      type: 'meal',
      timestamp: new Date().toISOString(),
      mealType,
      foods: allFoods.map((name) => ({ name })),
      portionSize: portionSize || undefined,
      notes: notes || undefined,
    })
  }

  return (
    <div className="space-y-5">
      {/* Meal Type */}
      <div>
        <span className="block text-sm font-medium text-stone-700 mb-2">
          Meal type
        </span>
        <div className="flex gap-1.5 flex-wrap">
          {MEAL_TYPES.map((mt) => (
            <button
              key={mt.value}
              type="button"
              onClick={() => setMealType(mt.value)}
              className={`flex flex-col items-center gap-0.5 p-2 min-w-[44px] min-h-[44px] rounded-xl border-2 transition-colors ${
                mealType === mt.value
                  ? 'border-green-400 bg-green-50'
                  : 'border-transparent hover:bg-stone-50'
              }`}
            >
              <span className="text-xl">{mt.emoji}</span>
              <span className="text-[10px] text-stone-500">{mt.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Foods */}
      <div>
        <span className="block text-sm font-medium text-stone-700 mb-2">
          What did you eat?
        </span>

        {/* Recent chips */}
        {recentFoods.length > 0 && (
          <div className="flex gap-2 mb-2">
            {recentFoods.map((food) => (
              <button
                key={food}
                type="button"
                onClick={() => addFood(food)}
                className="px-3 py-1.5 text-sm bg-green-50 text-green-800 rounded-full border border-green-200 hover:bg-green-100 transition-colors"
              >
                + {food}
              </button>
            ))}
          </div>
        )}

        {/* Food list */}
        <div className="space-y-2 mb-2">
          {foods.filter(Boolean).map((food, i) => (
            <div
              key={i}
              className="flex items-center gap-2 px-3 py-2 bg-stone-50 rounded-xl"
            >
              <span className="flex-1 text-sm">{food}</span>
              <button
                type="button"
                onClick={() => removeFood(i)}
                className="text-stone-400 hover:text-red-500 min-w-[44px] min-h-[44px] flex items-center justify-center"
                aria-label={`Remove ${food}`}
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        {/* Input + Add button + autocomplete */}
        <div className="relative">
          <div className="flex gap-2">
            <input
              type="text"
              value={foodInput}
              onChange={(e) => setFoodInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addFood(foodInput)
                }
              }}
              placeholder={
                foods.filter(Boolean).length === 0
                  ? 'Type a food and tap + to add'
                  : 'Add another food...'
              }
              className="flex-1 px-4 py-3 rounded-xl border border-stone-300 focus:border-green-400 focus:ring-2 focus:ring-green-100 outline-none text-sm"
            />
            <button
              type="button"
              onClick={() => addFood(foodInput)}
              disabled={!foodInput.trim()}
              className="px-4 py-3 bg-green-100 text-green-800 font-bold rounded-xl hover:bg-green-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors min-w-[44px] min-h-[44px] text-lg"
              aria-label="Add food item"
            >
              +
            </button>
          </div>
          {foodInput.trim() && foods.filter(Boolean).length === 0 && (
            <p className="text-xs text-stone-400 mt-1">
              Tap <strong>+</strong> or press Enter to add to your list
            </p>
          )}
          {suggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-stone-200 rounded-xl shadow-lg z-10 overflow-hidden">
              {suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => addFood(s)}
                  className="w-full text-left px-4 py-2.5 text-sm hover:bg-green-50 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Portion Size */}
      <div>
        <span className="block text-sm font-medium text-stone-700 mb-2">
          Portion size (optional)
        </span>
        <div className="flex gap-1.5">
          {PORTIONS.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() =>
                setPortionSize(portionSize === p.value ? '' : p.value)
              }
              className={`flex flex-col items-center gap-0.5 p-2 min-w-[44px] min-h-[44px] rounded-xl border-2 transition-colors ${
                portionSize === p.value
                  ? 'border-green-400 bg-green-50'
                  : 'border-transparent hover:bg-stone-50'
              }`}
            >
              <span className="text-xl">{p.emoji}</span>
              <span className="text-[10px] text-stone-500">{p.label}</span>
            </button>
          ))}
        </div>
      </div>

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
          placeholder="Any additional details..."
          className="w-full px-4 py-3 rounded-xl border border-stone-300 focus:border-green-400 focus:ring-2 focus:ring-green-100 outline-none text-sm resize-none"
        />
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!mealType || (foods.filter(Boolean).length === 0 && !foodInput.trim())}
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

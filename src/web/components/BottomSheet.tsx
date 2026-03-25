import { useEffect, useRef, useCallback, useState } from 'react'

interface BottomSheetProps {
  isOpen: boolean
  onClose: () => void
  title: string
  /** If true, shows "Discard changes?" confirmation on dismiss */
  isDirty?: boolean
  children: React.ReactNode
}

/**
 * BottomSheet — Modal sheet that slides up from bottom.
 *
 * Features (from DESIGN.md spec):
 * - Backdrop tap to dismiss
 * - Swipe down to dismiss (touch drag on handle)
 * - ✕ button to dismiss
 * - Escape key to dismiss
 * - Focus trap (tab cycles within sheet)
 * - "Discard changes?" confirmation if isDirty
 * - ARIA: role=dialog, aria-modal, aria-labelledby
 * - 44px minimum touch targets
 */
export function BottomSheet({
  isOpen,
  onClose,
  title,
  isDirty = false,
  children,
}: BottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null)
  const [translateY, setTranslateY] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const dragStartY = useRef(0)

  const handleDismiss = useCallback(() => {
    if (isDirty) {
      const confirmed = window.confirm('Discard changes?')
      if (!confirmed) return
    }
    onClose()
  }, [isDirty, onClose])

  // Escape key
  useEffect(() => {
    if (!isOpen) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleDismiss()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [isOpen, handleDismiss])

  // Focus trap
  useEffect(() => {
    if (!isOpen || !sheetRef.current) return

    const sheet = sheetRef.current
    const focusable = sheet.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
    const first = focusable[0]
    const last = focusable[focusable.length - 1]

    first?.focus()

    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault()
          last?.focus()
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault()
          first?.focus()
        }
      }
    }

    sheet.addEventListener('keydown', handleTab)
    return () => sheet.removeEventListener('keydown', handleTab)
  }, [isOpen])

  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  // Touch drag on handle
  const handleTouchStart = (e: React.TouchEvent) => {
    setIsDragging(true)
    dragStartY.current = e.touches[0].clientY
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return
    const dy = e.touches[0].clientY - dragStartY.current
    if (dy > 0) setTranslateY(dy) // only allow dragging down
  }

  const handleTouchEnd = () => {
    setIsDragging(false)
    if (translateY > 120) {
      handleDismiss()
    }
    setTranslateY(0)
  }

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-40 transition-opacity"
        onClick={handleDismiss}
        aria-hidden="true"
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="sheet-title"
        className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl max-h-[85dvh] flex flex-col shadow-2xl"
        style={{
          transform: `translateY(${translateY}px)`,
          transition: isDragging ? 'none' : 'transform 300ms ease-out',
        }}
      >
        {/* Handle + Close */}
        <div
          className="flex items-center justify-between px-6 pt-3 pb-2 cursor-grab"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className="flex-1" />
          <div className="w-10 h-1 bg-stone-300 rounded-full" />
          <div className="flex-1 flex justify-end">
            <button
              onClick={handleDismiss}
              className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl hover:bg-stone-100 text-stone-400 hover:text-stone-600"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Title */}
        <h2
          id="sheet-title"
          className="text-lg font-semibold text-stone-900 px-6 pb-3"
        >
          {title}
        </h2>

        {/* Content (scrollable) */}
        <div className="flex-1 overflow-y-auto px-6 pb-8">{children}</div>
      </div>
    </>
  )
}

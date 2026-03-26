import { useCallback } from 'react'
import { Drawer } from 'vaul'

interface BottomSheetProps {
  isOpen: boolean
  onClose: () => void
  title: string
  /** If true, shows "Discard changes?" confirmation on dismiss */
  isDirty?: boolean
  children: React.ReactNode
}

/**
 * BottomSheet — Modal drawer that slides up from bottom (powered by vaul).
 *
 * Features:
 * - Backdrop tap to dismiss
 * - Swipe down to dismiss (native vaul gesture)
 * - ✕ button to dismiss
 * - Escape key to dismiss
 * - Focus trap (handled by vaul/Radix Dialog)
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
  const handleDismiss = useCallback(
    (open: boolean) => {
      if (open) return
      if (isDirty) {
        const confirmed = window.confirm('Discard changes?')
        if (!confirmed) return
      }
      onClose()
    },
    [isDirty, onClose]
  )

  const handleClose = useCallback(() => {
    if (isDirty) {
      const confirmed = window.confirm('Discard changes?')
      if (!confirmed) return
    }
    onClose()
  }, [isDirty, onClose])

  return (
    <Drawer.Root open={isOpen} onOpenChange={handleDismiss} repositionInputs={false}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 bg-black/30 z-40" />
        <Drawer.Content
          aria-labelledby="sheet-title"
          className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl max-h-[85dvh] flex flex-col shadow-2xl outline-none"
        >
          {/* Handle + Close */}
          <div className="flex items-center justify-between px-6 pt-3 pb-2">
            <div className="flex-1" />
            <Drawer.Handle className="!w-10 !h-1 !bg-[#ccc] !rounded-full" />
            <div className="flex-1 flex justify-end">
              <button
                onClick={handleClose}
                className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-[#f5f5f5] text-[#999] hover:text-[#666]"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Title */}
          <Drawer.Title
            id="sheet-title"
            className="text-[15px] font-semibold text-[#333] px-6 pb-3"
          >
            {title}
          </Drawer.Title>

          {/* Content (scrollable) */}
          <div className="flex-1 overflow-y-auto px-6 pb-8">{children}</div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}

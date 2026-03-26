import { useState, useEffect, useCallback, createContext, useContext } from 'react'

interface ToastMessage {
  id: string
  text: string
}

interface ToastContextValue {
  showToast: (text: string) => void
}

const ToastContext = createContext<ToastContextValue>({ showToast: () => {} })

export function useToast() {
  return useContext(ToastContext)
}

/**
 * ToastProvider — Global toast notification system.
 * Shows "Saved ✓" style toasts that auto-dismiss after 1.5s.
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  const showToast = useCallback((text: string) => {
    const id = crypto.randomUUID()
    setToasts((prev) => [...prev, { id, text }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 1500)
  }, [])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}

      {/* Toast container */}
      <div className="fixed top-4 right-4 z-[60] flex flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            aria-live="polite"
            className="bg-[#4a7c59] text-white px-4 py-2.5 rounded-lg shadow-lg text-sm font-medium animate-fade-in"
          >
            {toast.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

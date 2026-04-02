import { useState, useEffect, useCallback, createContext, useContext } from 'react'

interface ToastMessage {
  id: string
  text: string
  variant?: 'success' | 'error'
}

interface ToastContextValue {
  showToast: (text: string, variant?: 'success' | 'error') => void
}

const ToastContext = createContext<ToastContextValue>({ showToast: () => {} })

export function useToast() {
  return useContext(ToastContext)
}

/**
 * ToastProvider — Global toast notification system.
 * Shows "Saved ✓" style toasts that auto-dismiss after 1.5s (success) or 4s (error).
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  const showToast = useCallback((text: string, variant: 'success' | 'error' = 'success') => {
    const id = crypto.randomUUID()
    setToasts((prev) => [...prev, { id, text, variant }])
    const duration = variant === 'error' ? 4000 : 1500
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, duration)
  }, [])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}

      {/* Toast container */}
      <div className="fixed top-4 right-4 z-[60] flex flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role={toast.variant === 'error' ? 'alert' : 'status'}
            aria-live={toast.variant === 'error' ? 'assertive' : 'polite'}
            className={`px-4 py-2.5 rounded-lg shadow-lg text-sm font-medium animate-fade-in text-white ${
              toast.variant === 'error'
                ? 'bg-[var(--danger-text)]'
                : 'bg-[var(--green-primary)]'
            }`}
          >
            {toast.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

/**
 * ErrorBoundary — Catches React render errors and shows a friendly fallback.
 * Prevents the whole app from crashing on an uncaught component error.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-dvh flex items-center justify-center bg-[var(--bg-primary)] px-4">
          <div className="max-w-sm text-center">
            <p className="text-4xl mb-4">😵</p>
            <h1 className="text-[15px] font-bold text-[var(--text-primary)] mb-2">
              Something went wrong
            </h1>
            <p className="text-xs text-[var(--text-label)] mb-6">
              {this.state.error?.message || 'An unexpected error occurred.'}
            </p>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null })
                window.location.href = '/'
              }}
              className="px-6 py-3 bg-[var(--green-primary)] text-white font-semibold rounded-lg hover:bg-[var(--green-hover)] transition-colors min-h-[44px]"
            >
              Go back home
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

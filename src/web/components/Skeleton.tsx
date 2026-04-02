/**
 * Skeleton loading components for perceived performance.
 * Used while data is being fetched from the API.
 */

export function TimelineSkeleton() {
  return (
    <div className="space-y-2 animate-pulse" aria-hidden="true">
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="flex items-center gap-3 p-3 bg-[var(--bg-card)] rounded-[10px] border border-[var(--border-card)]"
        >
          <div className="w-2.5 h-2.5 rounded-full bg-[var(--bg-muted)]" />
          <div className="w-12 h-3 rounded bg-[var(--bg-muted)]" />
          <div className="flex-1 h-3 rounded bg-[var(--bg-muted)]" />
          <div className="w-6 h-6 rounded bg-[var(--bg-hover-strong)]" />
        </div>
      ))}
    </div>
  )
}

export function InsightsSkeleton() {
  return (
    <div className="space-y-3 animate-pulse" aria-hidden="true">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="bg-[var(--insight-bg)] border border-[var(--insight-border)] rounded-[10px] p-3"
        >
          <div className="flex items-start justify-between mb-3">
            <div className="h-4 w-24 rounded bg-[var(--insight-border)]" />
            <div className="h-5 w-16 rounded-full bg-[var(--insight-border)]" />
          </div>
          <div className="h-2 w-full rounded-full bg-[var(--insight-border)] mb-3" />
          <div className="h-8 w-full rounded-lg bg-[var(--insight-border)]" />
        </div>
      ))}
    </div>
  )
}

export function ExperimentsSkeleton() {
  return (
    <div className="space-y-3 animate-pulse" aria-hidden="true">
      {[1, 2].map((i) => (
        <div
          key={i}
          className="p-4 bg-[var(--bg-card)] border border-[var(--border-card)] rounded-[10px]"
        >
          <div className="flex items-center gap-2 mb-3">
            <div className="w-5 h-5 rounded-full bg-[var(--bg-muted)]" />
            <div className="h-4 w-32 rounded bg-[var(--bg-muted)]" />
          </div>
          <div className="h-2 w-full rounded-full bg-[var(--bg-hover-strong)]" />
        </div>
      ))}
    </div>
  )
}

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
          className="flex items-center gap-3 p-3 bg-white rounded-[10px] border border-[#eee]"
        >
          <div className="w-2.5 h-2.5 rounded-full bg-[#e0e0e0]" />
          <div className="w-12 h-3 rounded bg-[#e0e0e0]" />
          <div className="flex-1 h-3 rounded bg-[#e0e0e0]" />
          <div className="w-6 h-6 rounded bg-[#eee]" />
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
          className="bg-purple-50/50 border border-purple-100 rounded-[10px] p-3"
        >
          <div className="flex items-start justify-between mb-3">
            <div className="h-4 w-24 rounded bg-purple-200" />
            <div className="h-5 w-16 rounded-full bg-purple-100" />
          </div>
          <div className="h-2 w-full rounded-full bg-purple-100 mb-3" />
          <div className="h-8 w-full rounded-lg bg-[#e0d4f5]" />
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
          className="p-4 bg-white border border-[#eee] rounded-[10px]"
        >
          <div className="flex items-center gap-2 mb-3">
            <div className="w-5 h-5 rounded-full bg-[#e0e0e0]" />
            <div className="h-4 w-32 rounded bg-[#e0e0e0]" />
          </div>
          <div className="h-2 w-full rounded-full bg-[#eee]" />
        </div>
      ))}
    </div>
  )
}

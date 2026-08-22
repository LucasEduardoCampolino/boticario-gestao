// src/components/PullToRefresh.tsx
import { usePullToRefresh } from '../hooks/usePullToRefresh'

interface PullToRefreshProps {
  onRefresh: () => Promise<void>
  children: React.ReactNode
}

function PullToRefresh({ onRefresh, children }: PullToRefreshProps) {
  const { isPulling, pullDistance } = usePullToRefresh({ onRefresh })

  return (
    <div className="relative min-h-screen">
      {isPulling && (
        <div
          className="pointer-events-none fixed left-1/2 top-0 z-50 -translate-x-1/2 transform transition-transform duration-200"
          style={{ transform: `translate(-50%, ${Math.min(pullDistance - 40, 60)}px)` }}
        >
          <div className="flex items-center gap-2 rounded-full bg-white px-4 py-2 shadow-lg">
            <svg
              className={`h-5 w-5 text-pink-600 ${pullDistance > 80 ? 'animate-spin' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            <span className="text-sm font-medium text-gray-700">
              {pullDistance > 80 ? 'Soltar para atualizar' : 'Puxe para atualizar'}
            </span>
          </div>
        </div>
      )}
      {children}
    </div>
  )
}

export default PullToRefresh
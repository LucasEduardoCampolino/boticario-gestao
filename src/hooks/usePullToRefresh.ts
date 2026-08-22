// src/hooks/usePullToRefresh.ts
import { useEffect, useRef, useState } from 'react'

interface PullToRefreshOptions {
  onRefresh: () => Promise<void>
  threshold?: number
}

export function usePullToRefresh({ onRefresh, threshold = 80 }: PullToRefreshOptions) {
  const [isPulling, setIsPulling] = useState(false)
  const [pullDistance, setPullDistance] = useState(0)
  const startY = useRef(0)
  const isPullingRef = useRef(false)
  const pullDistanceRef = useRef(0)
  const refreshingRef = useRef(false)

  useEffect(() => {
    function handleTouchStart(e: TouchEvent) {
      if (window.scrollY <= 0 && !refreshingRef.current) {
        startY.current = e.touches[0].clientY
        isPullingRef.current = true
      }
    }

    function handleTouchMove(e: TouchEvent) {
      if (!isPullingRef.current || refreshingRef.current) return

      const currentY = e.touches[0].clientY
      const distance = currentY - startY.current

      if (distance > 0 && window.scrollY <= 0) {
        // Aplicar resistência para não puxar demais
        const resistance = 0.5
        const maxPull = threshold + 20
        pullDistanceRef.current = Math.min(distance * resistance, maxPull)
        setPullDistance(pullDistanceRef.current)
        setIsPulling(true)

        if (distance > threshold) {
          e.preventDefault()
        }
      }
    }

    async function handleTouchEnd() {
      if (!isPullingRef.current || refreshingRef.current) return

      if (pullDistanceRef.current >= threshold) {
        refreshingRef.current = true
        setPullDistance(threshold)
        setIsPulling(true)

        try {
          await onRefresh()
        } catch (error) {
          console.error('Erro ao atualizar:', error)
        } finally {
          refreshingRef.current = false
          pullDistanceRef.current = 0
          setPullDistance(0)
          setIsPulling(false)
          isPullingRef.current = false
        }
      } else {
        pullDistanceRef.current = 0
        setPullDistance(0)
        setIsPulling(false)
        isPullingRef.current = false
      }
    }

    document.addEventListener('touchstart', handleTouchStart, { passive: true })
    document.addEventListener('touchmove', handleTouchMove, { passive: false })
    document.addEventListener('touchend', handleTouchEnd, { passive: true })

    return () => {
      document.removeEventListener('touchstart', handleTouchStart)
      document.removeEventListener('touchmove', handleTouchMove)
      document.removeEventListener('touchend', handleTouchEnd)
    }
  }, [onRefresh, threshold])

  return { isPulling, pullDistance }
}
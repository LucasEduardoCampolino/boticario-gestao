// src/components/ToastContainer.tsx
import { useState, useCallback } from 'react'
import Toast from './Toast'
import { ToastContext } from '../hooks/useToast'
import type { ToastType } from '../hooks/useToast'

interface ToastItem {
  id: number
  message: string
  type: ToastType
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const [nextId, setNextId] = useState(1)

  const showToast = useCallback((message: string, type: ToastType) => {
    const id = nextId
    setNextId((prev) => prev + 1)
    setToasts((prev) => [...prev, { id, message, type }])
  }, [nextId])

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[100] flex flex-col items-center gap-2 px-4">
        {toasts.map((toast) => (
          <div key={toast.id} className="pointer-events-auto">
            <Toast
              message={toast.message}
              type={toast.type}
              onClose={() => removeToast(toast.id)}
            />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
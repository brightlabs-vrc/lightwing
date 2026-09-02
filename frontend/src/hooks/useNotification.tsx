'use client'

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'

export type ToastSeverity = 'success' | 'error' | 'warning' | 'info'

export interface ToastMessage {
  id: string
  message: string
  severity: ToastSeverity
  title?: string
  noAutoDismiss?: boolean
}

interface NotificationContextType {
  toasts: ToastMessage[]
  addToast: (msg: Omit<ToastMessage, 'id'>) => void
  removeToast: (id: string) => void
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined)

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([])
  const toastsRef = useRef(toasts)
  toastsRef.current = toasts
  const [mounted, setMounted] = useState(false)

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const addToast = useCallback((msg: Omit<ToastMessage, 'id'>) => {
    const duplicate = toastsRef.current.find(
      (t) => t.message === msg.message && t.severity === msg.severity && t.title === msg.title
    )
    if (duplicate) {
      return
    }

    const id = crypto.randomUUID()
    const newToast: ToastMessage = { ...msg, id }

    setToasts((prev) => [...prev, newToast])

    if (msg.severity !== 'error' && !msg.noAutoDismiss) {
      setTimeout(() => {
        removeToast(id)
      }, 5000)
    }
  }, [removeToast])

  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <NotificationContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      {mounted && createPortal(
        <div className="lightwing-toast-container" aria-live="polite" aria-atomic="true">
          {toasts.map((toast) => {
            let bgColor = '#0969da'
            if (toast.severity === 'success') {
              bgColor = '#1a7f37'
            } else if (toast.severity === 'error') {
              bgColor = '#cf222e'
            } else if (toast.severity === 'warning') {
              bgColor = '#9a6700'
            }

            return (
              <div
                key={toast.id}
                className="lightwing-toast-item"
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.75rem',
                  width: '100%',
                  borderRadius: '6px',
                  padding: '1rem',
                  pointerEvents: 'auto',
                  backgroundColor: bgColor,
                  color: '#ffffff',
                  marginBottom: '0.5rem',
                }}
              >
                <div style={{ flexGrow: 1, minWidth: 0 }}>
                  {toast.title && (
                    <span style={{ fontWeight: 'bold', display: 'block', marginBottom: '0.25rem', fontSize: '14px' }}>
                      {toast.title}
                    </span>
                  )}
                  <span style={{ fontSize: '14px', wordBreak: 'break-word', display: 'block' }}>{toast.message}</span>
                </div>
                <button
                  type="button"
                  aria-label="Dismiss notification"
                  onClick={() => removeToast(toast.id)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'inherit',
                    cursor: 'pointer',
                    fontSize: '16px',
                    lineHeight: 1,
                    padding: '2px 6px',
                  }}
                >
                  ✕
                </button>
              </div>
            )
          })}
        </div>,
        document.body
      )}
    </NotificationContext.Provider>
  )
}

export const useNotification = () => {
  const context = useContext(NotificationContext)
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider')
  }
  return context
}

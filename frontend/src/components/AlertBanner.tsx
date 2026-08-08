import React, { ReactNode } from 'react'
import { Flash } from '@primer/react'

type AlertVariant = 'error' | 'success' | 'warning'

interface AlertBannerProps {
  variant: AlertVariant
  children: ReactNode
  action?: ReactNode
}

export function AlertBanner({ variant, children, action }: AlertBannerProps) {
  let scheme: 'default' | 'success' | 'warning' | 'danger' = 'default'
  if (variant === 'success') scheme = 'success'
  else if (variant === 'error') scheme = 'danger'
  else if (variant === 'warning') scheme = 'warning'

  return (
    <Flash
      variant={scheme}
      style={{
        borderRadius: '6px',
        padding: '12px 16px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '1rem',
      }}
    >
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <span>
          {variant === 'error' ? '⚠️' : variant === 'success' ? '✓' : '📝'}
        </span>
        <div style={{ fontSize: '14px' }}>{children}</div>
      </div>
      {action}
    </Flash>
  )
}
export default AlertBanner

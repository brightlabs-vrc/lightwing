import type { ReactNode } from 'react'
import { Flash } from '@primer/react'
import { AlertIcon, CheckCircleIcon, InfoIcon } from '@primer/octicons-react'

type AlertVariant = 'error' | 'success' | 'warning' | 'info'

interface AlertBannerProps {
  variant: AlertVariant
  children: ReactNode
  action?: ReactNode
}

const PRIMER_VARIANT: Record<AlertVariant, 'danger' | 'success' | 'warning' | 'default'> = {
  error: 'danger',
  success: 'success',
  warning: 'warning',
  info: 'default',
}

export function AlertBanner({ variant, children, action }: AlertBannerProps) {
  const Icon =
    variant === 'error'
      ? AlertIcon
      : variant === 'success'
      ? CheckCircleIcon
      : variant === 'warning'
      ? AlertIcon
      : InfoIcon

  return (
    <Flash
      variant={PRIMER_VARIANT[variant]}
      style={{
        marginBottom: '16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        flexWrap: 'wrap',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', flex: '1 1 auto', minWidth: 0 }}>
        <span style={{ flexShrink: 0, marginTop: '2px', display: 'inline-flex' }}>
          <Icon size={16} />
        </span>
        <div style={{ fontSize: '13px', lineHeight: 1.5, minWidth: 0, flex: '1 1 auto' }}>
          {children}
        </div>
      </div>
      {action && <div style={{ flexShrink: 0 }}>{action}</div>}
    </Flash>
  )
}

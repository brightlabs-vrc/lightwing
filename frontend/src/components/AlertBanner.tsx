import type { CSSProperties, ReactNode } from 'react'

type AlertVariant = 'error' | 'success' | 'warning'

interface AlertBannerProps {
  variant: AlertVariant
  children: ReactNode
  action?: ReactNode
}

const VARIANT_STYLES: Record<AlertVariant, CSSProperties> = {
  error: { background: '#d32f2f', color: '#fff' },
  success: { background: '#2e7d32', color: '#fff' },
  warning: { background: '#fffbeb', color: '#b45309', border: '1px solid #fde68a' },
}

const VARIANT_ICON: Record<AlertVariant, string> = {
  error: '⚠️',
  success: '✓',
  warning: '📝',
}

export function AlertBanner({ variant, children, action }: AlertBannerProps) {
  return (
    <div
      className="slds-notify slds-notify_alert slds-theme_alert-texture slds-m-bottom_medium"
      role="alert"
      style={{
        borderRadius: '4px',
        padding: '10px 16px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        ...VARIANT_STYLES[variant],
      }}
    >
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <span className="slds-icon_container slds-p-right_small">{VARIANT_ICON[variant]}</span>
        <h2>{children}</h2>
      </div>
      {action}
    </div>
  )
}

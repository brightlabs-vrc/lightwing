import { Spinner } from '@primer/react'

interface LoadingBoxProps {
  message: string
}

export function LoadingBox({ message }: LoadingBoxProps) {
  return (
    <div
      className="primer-box"
      style={{
        minHeight: '320px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        gap: '12px',
        padding: '32px',
        color: 'var(--fgColor-muted, #636c76)',
      }}
    >
      <Spinner size="medium" />
      <p style={{ margin: 0, fontSize: '14px', fontWeight: 500 }}>{message}</p>
    </div>
  )
}

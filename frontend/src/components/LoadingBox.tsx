import React from 'react'
import { Spinner } from '@primer/react'

interface LoadingBoxProps {
  message: string
}

export function LoadingBox({ message }: LoadingBoxProps) {
  return (
    <div
      style={{
        backgroundColor: 'var(--color-canvas-default)',
        borderRadius: '6px',
        border: '1px solid var(--color-border-default)',
        minHeight: '400px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <Spinner size="medium" />
      <p style={{ fontSize: '14px', color: '#57606a', margin: 0 }}>{message}</p>
    </div>
  )
}
export default LoadingBox

import React from 'react'

interface GradePointsPreviewProps {
  grade: string
  table: Record<number, number>
}

export const GradePointsPreview: React.FC<GradePointsPreviewProps> = ({ grade, table }) => {
  return (
    <div
      style={{
        backgroundColor: 'var(--color-canvas-default)',
        borderRadius: '6px',
        border: '1px solid var(--color-border-default)',
        padding: '12px',
        flex: '1 1 200px',
        minWidth: '220px',
      }}
    >
      <h4
        style={{
          fontSize: '11px',
          textTransform: 'uppercase',
          fontWeight: 'bold',
          marginBottom: '8px',
          marginTop: 0,
          color: 'var(--color-fg-default)'
        }}
      >
        Grade {grade}
      </h4>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px' }}>
        {Array.from({ length: 10 }).map((_, i) => {
          const pos = i + 1
          const pts = table[pos] ?? 0
          return (
            <div
              key={pos}
              style={{
                border: '1px solid var(--color-border-default)',
                borderRadius: '4px',
                backgroundColor: 'var(--color-canvas-subtle)',
                padding: '4px',
                textAlign: 'center',
                fontSize: '11px',
              }}
            >
              <div style={{ color: '#57606a', fontSize: '9px' }}>#{pos}</div>
              <div style={{ fontWeight: 'bold', color: 'var(--color-fg-default)' }}>{pts}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
export default GradePointsPreview

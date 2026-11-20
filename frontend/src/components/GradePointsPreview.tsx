import React from 'react'

interface GradePointsPreviewProps {
  grade: string
  table: Record<number, number>
}

export const GradePointsPreview: React.FC<GradePointsPreviewProps> = ({ grade, table }) => {
  return (
    <div
      style={{
        backgroundColor: 'var(--bgColor-default, #ffffff)',
        borderRadius: '6px',
        border: '1px solid var(--borderColor-default, #d0d7de)',
        padding: '12px',
        flex: '1 1 200px',
        minWidth: '220px',
      }}
    >
      <h4
        style={{
          fontSize: '11px',
          textTransform: 'uppercase',
          fontWeight: 600,
          color: 'var(--fgColor-muted, #636c76)',
          letterSpacing: '0.04em',
          margin: '0 0 8px 0',
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
                border: '1px solid var(--borderColor-muted, #d8dee4)',
                borderRadius: '4px',
                backgroundColor: 'var(--bgColor-muted, #f6f8fa)',
                padding: '4px',
                textAlign: 'center',
                fontSize: '11px',
              }}
            >
              <div style={{ color: 'var(--fgColor-muted, #636c76)', fontSize: '9px' }}>#{pos}</div>
              <div style={{ fontWeight: 600, color: 'var(--fgColor-default, #1f2328)' }}>{pts}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

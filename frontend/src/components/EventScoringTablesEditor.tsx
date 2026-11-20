import React from 'react'

interface EventScoringTablesEditorProps {
  value: any
  onChange: (value: any) => void
}

export const EventScoringTablesEditor: React.FC<EventScoringTablesEditorProps> = ({ value, onChange }) => {
  const grades = ['OP', 'GIII', 'GII', 'GI']
  const masterAutoDeferEnabled = value.autoDeferEnabled !== false

  const handleMasterAutoDeferToggle = (enabled: boolean) => {
    const updated = {
      ...value,
      autoDeferEnabled: enabled,
    }
    onChange(updated)
  }

  const handleCellChange = (grade: string, pos: number, valStr: string) => {
    const intVal = valStr === '' ? 0 : parseInt(valStr, 10) || 0
    const updated = {
      ...value,
      [grade]: {
        ...(value[grade] || {}),
        [pos]: intVal,
      },
    }
    onChange(updated)
  }

  const handleAutoDeferChange = (grade: string, autoDefer: boolean) => {
    const updated = {
      ...value,
      [grade]: {
        ...(value[grade] || {}),
        autoDefer,
      },
    }
    onChange(updated)
  }

  return (
    <div style={{ marginTop: '12px' }}>
      <div
        style={{
          backgroundColor: 'var(--bgColor-muted, #f6f8fa)',
          border: '1px solid var(--borderColor-default, #d0d7de)',
          padding: '12px',
          borderRadius: '6px',
          marginBottom: '12px',
        }}
      >
        <label
          style={{
            fontSize: '13px',
            fontWeight: 600,
            color: 'var(--fgColor-default, #1f2328)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            cursor: 'pointer',
          }}
        >
          <input
            type="checkbox"
            checked={masterAutoDeferEnabled}
            onChange={(e) => handleMasterAutoDeferToggle(e.target.checked)}
          />
          Enable Auto-Deferral Rules for Ungraded Winners
        </label>
        <p style={{ fontSize: '12px', color: 'var(--fgColor-muted, #636c76)', margin: '4px 0 0 22px' }}>
          When enabled, ungraded competitors placing 1st in an auto-deferral race will be marked as Deferred in other races for this event.
        </p>
      </div>

      <p style={{ fontSize: '12px', color: 'var(--fgColor-muted, #636c76)', margin: '4px 0 12px 0' }}>
        Configure the points allocated to positions 1-10 for each race grade in custom scoring mode.
      </p>
      {grades.map((grade) => {
        const table = value[grade] || {}
        return (
          <div
            key={grade}
            style={{
              backgroundColor: 'var(--bgColor-muted, #f6f8fa)',
              padding: '12px',
              borderRadius: '6px',
              border: '1px solid var(--borderColor-default, #d0d7de)',
              marginBottom: '10px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
              <h4
                style={{
                  fontSize: '11px',
                  textTransform: 'uppercase',
                  fontWeight: 600,
                  color: 'var(--fgColor-muted, #636c76)',
                  margin: 0,
                  letterSpacing: '0.04em',
                }}
              >
                Grade {grade}
              </h4>
              <label
                style={{
                  fontSize: '12px',
                  color: masterAutoDeferEnabled ? 'var(--fgColor-default, #1f2328)' : 'var(--fgColor-disabled, #8c959f)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: masterAutoDeferEnabled ? 'pointer' : 'not-allowed',
                }}
              >
                <input
                  type="checkbox"
                  disabled={!masterAutoDeferEnabled}
                  checked={masterAutoDeferEnabled && (table.autoDefer ?? grade === 'OP')}
                  onChange={(e) => handleAutoDeferChange(grade, e.target.checked)}
                />
                Auto-defer 1st place if ungraded
              </label>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px' }}>
              {Array.from({ length: 10 }).map((_, i) => {
                const pos = i + 1
                const pts = table[pos] !== undefined ? table[pos] : ''
                return (
                  <div key={pos} style={{ margin: 0 }}>
                    <label
                      style={{
                        fontSize: '11px',
                        color: 'var(--fgColor-muted, #636c76)',
                        display: 'block',
                        marginBottom: '2px',
                      }}
                    >
                      Position #{pos}
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={pts}
                      onChange={(e) => handleCellChange(grade, pos, e.target.value)}
                      style={{
                        padding: '4px 8px',
                        border: '1px solid var(--borderColor-default, #d0d7de)',
                        borderRadius: '6px',
                        textAlign: 'center',
                        height: '30px',
                        backgroundColor: 'var(--bgColor-default, #ffffff)',
                        color: 'var(--fgColor-default, #1f2328)',
                        fontSize: '12px',
                        width: '100%',
                      }}
                    />
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

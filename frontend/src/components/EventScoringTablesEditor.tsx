import React from 'react'
import { Heading, Text, TextInput, FormControl } from '@primer/react'

interface EventScoringTablesEditorProps {
  value: Record<string, Record<number, number>>
  onChange: (value: Record<string, Record<number, number>>) => void
}

export const EventScoringTablesEditor: React.FC<EventScoringTablesEditorProps> = ({ value, onChange }) => {
  const grades = ['OP', 'GIII', 'GII', 'GI']

  const handleCellChange = (grade: string, pos: number, valStr: string) => {
    const intVal = valStr === '' ? 0 : (parseInt(valStr, 10) || 0)
    const updated = {
      ...value,
      [grade]: {
        ...(value[grade] || {}),
        [pos]: intVal,
      },
    }
    onChange(updated)
  }

  return (
    <div style={{ marginTop: '12px' }}>
      <p style={{ fontSize: '12px', margin: '4px 0 12px 0', color: '#57606a' }}>
        Configure the points allocated to positions 1-10 for each race grade in custom scoring mode.
      </p>
      {grades.map((grade) => {
        const table = value[grade] || {}
        return (
          <div
            key={grade}
            style={{
              backgroundColor: 'var(--color-canvas-subtle)',
              padding: '12px',
              borderRadius: '6px',
              border: '1px solid var(--color-border-default)',
              marginBottom: '1rem',
            }}
          >
            <h4
              style={{
                fontSize: '11px',
                textTransform: 'uppercase',
                fontWeight: 'bold',
                margin: '0 0 12px 0',
                color: 'var(--color-fg-default)',
              }}
            >
              Grade {grade}
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px' }}>
              {Array.from({ length: 10 }).map((_, i) => {
                const pos = i + 1
                const pts = table[pos] !== undefined ? table[pos] : ''
                return (
                  <div key={pos}>
                    <FormControl>
                      <FormControl.Label style={{ fontSize: '10px', color: '#64748b' }}>
                        Position #{pos}
                      </FormControl.Label>
                      <TextInput
                        type="number"
                        min="0"
                        value={pts}
                        onChange={(e) => handleCellChange(grade, pos, e.target.value)}
                        size="small"
                        className="standings-input-no-spinner"
                        style={{
                          textAlign: 'center',
                          width: '100%',
                        }}
                      />
                    </FormControl>
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
export default EventScoringTablesEditor

import React from 'react';

interface EventScoringTablesEditorProps {
  value: Record<string, Record<number, number>>;
  onChange: (value: Record<string, Record<number, number>>) => void;
}

export const EventScoringTablesEditor: React.FC<EventScoringTablesEditorProps> = ({ value, onChange }) => {
  const grades = ['OP', 'GIII', 'GII', 'GI'];

  const handleCellChange = (grade: string, pos: number, valStr: string) => {
    const intVal = valStr === '' ? 0 : (parseInt(valStr, 10) || 0);
    const updated = {
      ...value,
      [grade]: {
        ...(value[grade] || {}),
        [pos]: intVal,
      },
    };
    onChange(updated);
  };

  return (
    <div style={{ marginTop: '12px' }}>
      <p
        className="slds-text-body_small text-slate-500 slds-m-bottom_medium"
        style={{ fontSize: '12px', margin: '4px 0 12px 0' }}
      >
        Configure the points allocated to positions 1-10 for each race grade in custom scoring mode.
      </p>
      {grades.map((grade) => {
        const table = value[grade] || {};
        return (
          <div
            key={grade}
            className="slds-box slds-m-bottom_small"
            style={{
              background: '#f8fafc',
              padding: '12px',
              borderRadius: '4px',
              border: '1px solid #dddbda',
            }}
          >
            <h4
              className="slds-text-title_caps font-bold text-slate-700"
              style={{
                fontSize: '11px',
                textTransform: 'uppercase',
                fontWeight: 'bold',
                marginBottom: '8px',
              }}
            >
              Grade {grade}
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px' }}>
              {Array.from({ length: 10 }).map((_, i) => {
                const pos = i + 1;
                const pts = table[pos] !== undefined ? table[pos] : '';
                return (
                  <div key={pos} className="slds-form-element" style={{ margin: 0 }}>
                    <label
                      className="slds-form-element__label"
                      style={{ fontSize: '10px', color: '#64748b', display: 'block' }}
                    >
                      Position #{pos}
                    </label>
                    <div className="slds-form-element__control">
                      <input
                        type="number"
                        min="0"
                        value={pts}
                        onChange={(e) => handleCellChange(grade, pos, e.target.value)}
                        className="slds-input"
                        style={{
                          padding: '4px 8px',
                          border: '1px solid #dddbda',
                          borderRadius: '4px',
                          textAlign: 'center',
                          height: '30px',
                          background: '#fff',
                          fontSize: '12px',
                          width: '100%',
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};

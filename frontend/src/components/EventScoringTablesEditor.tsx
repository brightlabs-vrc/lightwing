import React from 'react';

interface EventScoringTablesEditorProps {
  value: Record<string, Record<string | number, any>>;
  onChange: (value: Record<string, Record<string | number, any>>) => void;
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

  const handleAutoDeferChange = (grade: string, autoDefer: boolean) => {
    const updated = {
      ...value,
      [grade]: {
        ...(value[grade] || {}),
        autoDefer,
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <h4
                className="slds-text-title_caps font-bold text-slate-700"
                style={{
                  fontSize: '11px',
                  textTransform: 'uppercase',
                  fontWeight: 'bold',
                  margin: 0,
                }}
              >
                Grade {grade}
              </h4>
              <label style={{ fontSize: '11px', color: '#475569', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={table.autoDefer ?? (grade === 'OP')}
                  onChange={(e) => handleAutoDeferChange(grade, e.target.checked)}
                />
                Auto-defer 1st place if ungraded
              </label>
            </div>
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

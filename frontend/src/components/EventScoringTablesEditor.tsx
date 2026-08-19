import React from 'react';

interface EventScoringTablesEditorProps {
  value: any;
  onChange: (value: any) => void;
}

export const EventScoringTablesEditor: React.FC<EventScoringTablesEditorProps> = ({ value, onChange }) => {
  const grades = ['OP', 'GIII', 'GII', 'GI'];
  const masterAutoDeferEnabled = value.autoDeferEnabled !== false;

  const handleMasterAutoDeferToggle = (enabled: boolean) => {
    const updated = {
      ...value,
      autoDeferEnabled: enabled,
    };
    onChange(updated);
  };

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
      <div
        className="slds-box slds-m-bottom_medium"
        style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', padding: '12px', borderRadius: '4px' }}
      >
        <label style={{ fontSize: '13px', fontWeight: 'bold', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={masterAutoDeferEnabled}
            onChange={(e) => handleMasterAutoDeferToggle(e.target.checked)}
          />
          Enable Auto-Deferral Rules for Ungraded Winners
        </label>
        <p style={{ fontSize: '11px', color: '#64748b', margin: '4px 0 0 24px' }}>
          When enabled, ungraded competitors placing 1st in an auto-deferral race will be marked as Deferred in other races for this event.
        </p>
      </div>

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
              <label style={{ fontSize: '11px', color: masterAutoDeferEnabled ? '#475569' : '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px', cursor: masterAutoDeferEnabled ? 'pointer' : 'not-allowed' }}>
                <input
                  type="checkbox"
                  disabled={!masterAutoDeferEnabled}
                  checked={masterAutoDeferEnabled && (table.autoDefer ?? (grade === 'OP'))}
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

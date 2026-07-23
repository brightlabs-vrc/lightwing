import React from 'react';

interface GradePointsPreviewProps {
  grade: string;
  table: Record<number, number>;
}

export const GradePointsPreview: React.FC<GradePointsPreviewProps> = ({ grade, table }) => {
  return (
    <div
      className="slds-box bg-white"
      style={{
        background: '#ffffff',
        borderRadius: '4px',
        border: '1px solid #dddbda',
        padding: '12px',
        flex: '1 1 200px',
        minWidth: '220px',
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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px' }}>
        {Array.from({ length: 10 }).map((_, i) => {
          const pos = i + 1;
          const pts = table[pos] ?? 0;
          return (
            <div
              key={pos}
              style={{
                border: '1px solid #dddbda',
                borderRadius: '4px',
                background: '#f8fafc',
                padding: '4px',
                textAlign: 'center',
                fontSize: '11px',
              }}
            >
              <div style={{ color: '#64748b', fontSize: '9px' }}>#{pos}</div>
              <div style={{ fontWeight: 'bold', color: '#1e293b' }}>{pts}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

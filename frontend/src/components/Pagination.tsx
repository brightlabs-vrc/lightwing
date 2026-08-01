import React from 'react'

interface PaginationProps {
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
  onPageSizeChange?: (pageSize: number) => void
}

export const Pagination: React.FC<PaginationProps> = ({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
}) => {
  const totalPages = Math.ceil(total / pageSize) || 1
  const startRange = (page - 1) * pageSize + 1
  const endRange = Math.min(page * pageSize, total)

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 16px',
        background: '#f8fafc',
        border: '1px solid #e2e8f0',
        borderRadius: '6px',
        margin: '12px 0',
        fontSize: '13px',
        color: '#334155',
      }}
    >
      <div>
        <span>
          Showing <strong>{total > 0 ? startRange : 0}</strong>–<strong>{endRange}</strong> of{' '}
          <strong>{total}</strong> results
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        {onPageSizeChange && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>Show:</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              style={{
                padding: '4px 8px',
                border: '1px solid #cbd5e1',
                borderRadius: '4px',
                background: '#fff',
                cursor: 'pointer',
              }}
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
          </div>
        )}

        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            type="button"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            style={{
              padding: '6px 12px',
              border: '1px solid #cbd5e1',
              borderRadius: '4px',
              background: page <= 1 ? '#f1f5f9' : '#fff',
              cursor: page <= 1 ? 'not-allowed' : 'pointer',
              color: page <= 1 ? '#94a3b8' : '#334155',
              fontWeight: '500',
            }}
          >
            ◀ Prev
          </button>
          <span style={{ alignSelf: 'center', padding: '0 4px' }}>
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            style={{
              padding: '6px 12px',
              border: '1px solid #cbd5e1',
              borderRadius: '4px',
              background: page >= totalPages ? '#f1f5f9' : '#fff',
              cursor: page >= totalPages ? 'not-allowed' : 'pointer',
              color: page >= totalPages ? '#94a3b8' : '#334155',
              fontWeight: '500',
            }}
          >
            Next ▶
          </button>
        </div>
      </div>
    </div>
  )
}

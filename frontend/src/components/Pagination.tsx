import React from 'react'
import { PixelButton } from '@pxlkit/ui-kit'

interface PaginationProps {
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
  onPageSizeChange?: (pageSize: number) => void
  variant?: 'default' | 'pixel'
}

export const Pagination: React.FC<PaginationProps> = ({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  variant = 'default',
}) => {
  const totalPages = Math.ceil(total / pageSize) || 1
  const startRange = (page - 1) * pageSize + 1
  const endRange = Math.min(page * pageSize, total)

  if (variant === 'pixel') {
    return (
      <div
        className="border-4 border-retro-border bg-retro-bg font-pixel pxl-shadow pxl-corner-sm flex flex-col sm:flex-row items-center justify-between gap-4 p-4 text-[11px] text-retro-text my-4"
      >
        <div>
          <span>
            SHOWING <strong className="text-retro-primary">{total > 0 ? startRange : 0}</strong>–<strong className="text-retro-primary">{endRange}</strong> OF{' '}
            <strong className="text-retro-primary">{total}</strong> RESULTS
          </span>
        </div>

        <div className="flex items-center gap-4 flex-wrap">
          {onPageSizeChange && (
            <div className="flex items-center gap-2">
              <span>SHOW:</span>
              <select
                value={pageSize}
                onChange={(e) => onPageSizeChange(Number(e.target.value))}
                className="border-2 border-retro-border bg-retro-bg text-[11px] font-pixel text-retro-text p-1 pxl-corner-sm outline-none cursor-pointer focus:border-retro-primary"
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
            </div>
          )}

          <div className="flex items-center gap-3">
            <PixelButton
              variant="solid"
              tone="neutral"
              size="sm"
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
              className="pxl-btn-flat font-pixel text-[10px] h-8"
            >
              ◀ PREV
            </PixelButton>
            <span className="px-1 text-retro-muted">
              PAGE {page} OF {totalPages}
            </span>
            <PixelButton
              variant="solid"
              tone="neutral"
              size="sm"
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages}
              className="pxl-btn-flat font-pixel text-[10px] h-8"
            >
              NEXT ▶
            </PixelButton>
          </div>
        </div>
      </div>
    )
  }

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

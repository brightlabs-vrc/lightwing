import React from 'react'
import { Button, Select, Text, Pagination as PrimerPagination } from '@primer/react'

interface PaginationBarProps {
  page: number
  pageSize: number
  total: number
  onPageChange: (newPage: number) => void
  onPageSizeChange: (newPageSize: number) => void
  pageSizeOptions?: number[]
  variant?: string
}

export const PaginationBar: React.FC<PaginationBarProps> = ({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50, 100],
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
        flexWrap: 'wrap',
        gap: '1rem',
        paddingTop: '1rem',
        paddingBottom: '1rem',
        borderTop: '1px solid #d0d7de',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span style={{ fontSize: '14px', color: 'var(--color-fg-muted)' }}>
          {total > 0 ? `Showing ${startRange}–${endRange} of ${total}` : 'No results'}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '14px', color: 'var(--color-fg-muted)', whiteSpace: 'nowrap' }}>Rows per page:</span>
          <Select
            size="small"
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            aria-label="Rows per page"
          >
            {pageSizeOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </Select>
        </div>
        <PrimerPagination
          pageCount={totalPages}
          currentPage={page}
          onPageChange={(e, p) => {
            e.preventDefault()
            onPageChange(p)
          }}
          showPages={totalPages > 1}
        />
      </div>
    </div>
  )
}

export const PaginationBarLegacy: React.FC<PaginationBarProps> = (props) => {
  return <PaginationBar {...props} />
}

export const Pagination = PaginationBar
export default PaginationBar

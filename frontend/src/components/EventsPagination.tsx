'use client'

import { PaginationBar } from '@/components/Pagination'

export function EventsPagination({ total, page, pageSize }: { total: number; page: number; pageSize: number }) {
  return (
    <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'center' }}>
      <PaginationBar page={page} pageSize={pageSize} total={total} onPageChange={() => {}} onPageSizeChange={() => {}} />
    </div>
  )
}

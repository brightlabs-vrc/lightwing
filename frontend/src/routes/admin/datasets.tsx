import { Link, createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { requireSiteAdmin } from '../../lib/admin-guard'

export const Route = createFileRoute('/admin/datasets')({
  beforeLoad: async ({ location }) => {
    await requireSiteAdmin(location)
  },
  component: AdminDatasetsPage,
})

type DatasetStatus = 'PENDING' | 'RUNNING' | 'DONE' | 'FAILED'

interface DatasetRecord {
  id: string
  source: string
  importedAt: string
  rows: number
  status: DatasetStatus
}

const initialRecords: DatasetRecord[] = [
  {
    id: 'ds_2026_07_01',
    source: 'weekly-race-results.csv',
    importedAt: '2026-07-01T10:00:00Z',
    rows: 842,
    status: 'DONE',
  },
  {
    id: 'ds_2026_07_05',
    source: 'regional-signups.json',
    importedAt: '2026-07-05T12:42:00Z',
    rows: 391,
    status: 'PENDING',
  },
  {
    id: 'ds_2026_07_09',
    source: 'staff-review-export.parquet',
    importedAt: '2026-07-09T08:15:00Z',
    rows: 121,
    status: 'FAILED',
  },
]

function AdminDatasetsPage() {
  const [records, setRecords] = useState(initialRecords)

  function setStatus(id: string, status: DatasetStatus) {
    setRecords((current) =>
      current.map((record) => (record.id === id ? { ...record, status } : record)),
    )
  }

  return (
    <section className='space-y-6'>
      <header className='space-y-2'>
        <h1 className='text-3xl font-bold tracking-tight text-slate-900'>Dataset Records</h1>
        <p className='text-sm text-slate-600'>
          Operational panel for ingest pipeline visibility. Backend dataset-ingest endpoints are
          not exposed yet, so this panel runs as an admin workflow mock until those APIs land.
        </p>
      </header>

      <div className='overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm'>
        <table className='min-w-full divide-y divide-slate-200 text-sm'>
          <thead className='bg-slate-50'>
            <tr>
              <th className='px-3 py-2 text-left font-semibold text-slate-700'>Record</th>
              <th className='px-3 py-2 text-left font-semibold text-slate-700'>Source</th>
              <th className='px-3 py-2 text-left font-semibold text-slate-700'>Rows</th>
              <th className='px-3 py-2 text-left font-semibold text-slate-700'>Imported At</th>
              <th className='px-3 py-2 text-left font-semibold text-slate-700'>Status</th>
              <th className='px-3 py-2 text-left font-semibold text-slate-700'>Actions</th>
            </tr>
          </thead>
          <tbody className='divide-y divide-slate-100'>
            {records.map((record) => (
              <tr key={record.id}>
                <td className='px-3 py-3 text-slate-900'>{record.id}</td>
                <td className='px-3 py-3 text-slate-700'>{record.source}</td>
                <td className='px-3 py-3 text-slate-700'>{record.rows.toLocaleString()}</td>
                <td className='px-3 py-3 text-slate-700'>{new Date(record.importedAt).toLocaleString()}</td>
                <td className='px-3 py-3'>
                  <span className='rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700'>
                    {record.status}
                  </span>
                </td>
                <td className='px-3 py-3'>
                  <div className='flex flex-wrap gap-2'>
                    <button
                      type='button'
                      onClick={() => setStatus(record.id, 'RUNNING')}
                      className='rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50'
                    >
                      Retry
                    </button>
                    <button
                      type='button'
                      onClick={() => setStatus(record.id, 'DONE')}
                      className='rounded-md border border-emerald-300 px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50'
                    >
                      Mark Done
                    </button>
                    <button
                      type='button'
                      onClick={() => setStatus(record.id, 'FAILED')}
                      className='rounded-md border border-rose-300 px-2 py-1 text-xs font-medium text-rose-700 hover:bg-rose-50'
                    >
                      Mark Failed
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Link to='/admin' className='text-sm font-medium text-sky-700 hover:text-sky-800'>
        Back to Admin Dashboard
      </Link>
    </section>
  )
}

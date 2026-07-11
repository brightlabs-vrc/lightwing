import { Link, createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { requireSiteAdmin } from '../../lib/auth-guard'
import { AdminLayout } from './-AdminLayout'

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

// Private module-scoped static variable to keep local state when navigating between screens
const recordsBuffer = initialRecords

function AdminDatasetsPage() {
  const [records, setRecords] = useState(recordsBuffer)

  function setStatus(id: string, status: DatasetStatus) {
    setRecords((current) =>
      current.map((record) => (record.id === id ? { ...record, status } : record)),
    )
  }

  return (
    <AdminLayout
      title="Dataset Ingestion Records"
      subtitle="Operational panel for CSV/JSON/Parquet file ingestion. View records, retry failed ingest tasks, and mark tasks completed."
    >
      <div className="slds-grid slds-wrap slds-gutters">
        <div className="slds-col slds-size_1-of-1">
          <article className="slds-card" style={{ border: '1px solid #dddbda' }}>
            <div className="slds-card__header slds-grid">
              <header className="slds-media slds-media_center slds-has-flexi-truncate">
                <div className="slds-media__figure" style={{ marginRight: '0.5rem' }}>
                  <span className="slds-icon_container slds-icon-standard-dataset" style={{ fontSize: '18px' }}>📊</span>
                </div>
                <div className="slds-media__body">
                  <h2 className="slds-card__header-title">
                    <span className="slds-card__header-link slds-truncate font-semibold" style={{ fontWeight: 'bold' }}>
                      Data Pipeline Ingest Log
                    </span>
                  </h2>
                </div>
              </header>
            </div>

            <div className="slds-card__body slds-card__body_inner" style={{ padding: '0 1rem 1rem 1rem' }}>
              <p className="slds-text-body_small text-slate-500 slds-m-bottom_medium" style={{ fontSize: '12px' }}>
                Backend dataset-ingest endpoints are not fully exposed yet, so this pipeline runs as an admin operational workflow simulation until live endpoints land.
              </p>

              <div className="slds-scrollable_x">
                <table className="slds-table slds-table_cell-buffer slds-table_bordered" style={{ border: '1px solid #dddbda' }}>
                  <thead>
                    <tr className="slds-line-height_reset" style={{ background: '#f3f2f1' }}>
                      <th scope="col" style={{ fontWeight: 'bold' }}><div className="slds-truncate">Record ID</div></th>
                      <th scope="col" style={{ fontWeight: 'bold' }}><div className="slds-truncate">Source File Name</div></th>
                      <th scope="col" style={{ fontWeight: 'bold' }}><div className="slds-truncate">Row Count</div></th>
                      <th scope="col" style={{ fontWeight: 'bold' }}><div className="slds-truncate">Import Timestamp</div></th>
                      <th scope="col" style={{ fontWeight: 'bold' }}><div className="slds-truncate">Pipeline Status</div></th>
                      <th scope="col" style={{ fontWeight: 'bold', width: '220px' }}><div className="slds-truncate">Pipeline Controls</div></th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.map((record) => (
                      <tr key={record.id} className="slds-hint-parent">
                        <td><code className="text-xs font-bold" style={{ fontWeight: 'bold' }}>{record.id}</code></td>
                        <td><span className="font-semibold text-slate-800">{record.source}</span></td>
                        <td><strong>{record.rows.toLocaleString()}</strong> rows</td>
                        <td>{new Date(record.importedAt).toLocaleString()}</td>
                        <td>
                          {record.status === 'DONE' ? (
                            <span className="slds-badge slds-theme_success" style={{ padding: '2px 8px', borderRadius: '4px', background: '#2e7d32', color: '#fff' }}>
                              DONE
                            </span>
                          ) : record.status === 'RUNNING' ? (
                            <span className="slds-badge slds-theme_warning" style={{ padding: '2px 8px', borderRadius: '4px', background: '#ff9800', color: '#fff' }}>
                              RUNNING
                            </span>
                          ) : record.status === 'FAILED' ? (
                            <span className="slds-badge slds-theme_error" style={{ padding: '2px 8px', borderRadius: '4px', background: '#d32f2f', color: '#fff' }}>
                              FAILED
                            </span>
                          ) : (
                            <span className="slds-badge slds-theme_light" style={{ padding: '2px 8px', borderRadius: '4px', background: '#e0e0e0', color: '#333' }}>
                              PENDING
                            </span>
                          )}
                        </td>
                        <td>
                          <div className="slds-grid" style={{ display: 'flex', gap: '6px' }}>
                            <button
                              type="button"
                              onClick={() => setStatus(record.id, 'RUNNING')}
                              className="slds-button slds-button_neutral"
                              style={{ padding: '2px 10px', fontSize: '11px' }}
                            >
                              Retry
                            </button>
                            <button
                              type="button"
                              onClick={() => setStatus(record.id, 'DONE')}
                              className="slds-button slds-button_success"
                              style={{ padding: '2px 10px', fontSize: '11px', background: '#2e7d32', color: '#fff' }}
                            >
                              Mark Done
                            </button>
                            <button
                              type="button"
                              onClick={() => setStatus(record.id, 'FAILED')}
                              className="slds-button slds-button_destructive"
                              style={{ padding: '2px 10px', fontSize: '11px', background: '#d32f2f', color: '#fff' }}
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
            </div>
          </article>
        </div>
      </div>
    </AdminLayout>
  )
}

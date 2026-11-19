import { useState } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { useAuth } from '../../hooks/useAuth'
import { requireAdminPanel } from '../../lib/auth-guard'
import { recalculateRatings } from '../../lib/admin-api'
import { AdminLayout } from './-AdminLayout'

export const Route = createFileRoute('/admin/')({
  beforeLoad: async ({ location }) => {
    await requireAdminPanel(location)
  },
  component: AdminPage,
})

function AdminPage() {
  const { session } = useAuth()
  const isSiteAdmin = session?.user.siteRole === 'SITE_ADMIN'
  const [recalcLoading, setRecalcLoading] = useState(false)
  const [recalcMessage, setRecalcMessage] = useState<string | null>(null)
  const [recalcError, setRecalcError] = useState<string | null>(null)

  const handleRecalculateRatings = async () => {
    if (!session?.session.token) return
    try {
      setRecalcLoading(true)
      setRecalcMessage(null)
      setRecalcError(null)
      const res = await recalculateRatings(`Bearer ${session.session.token}`)
      setRecalcMessage(
        `Backfill complete: ${res.racesProcessed} races processed, ${res.resultsUpdated} results updated across ${res.usersRated} users.`,
      )
    } catch (err: any) {
      setRecalcError(err?.message || 'Failed to recalculate ratings')
    } finally {
      setRecalcLoading(false)
    }
  }

  return (
    <AdminLayout
      title="Admin Dashboard"
      subtitle="Welcome to the control center. Oversee system entities, manage dynamic event results, and verify ingestion pipelines."
    >
      <div className="slds-grid slds-wrap slds-gutters">
        {/* Active Session summary card */}
        <div className="slds-col slds-size_1-of-1 slds-m-bottom_large">
          <article className="slds-card" style={{ border: '1px solid #dddbda', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
            <div className="slds-card__header slds-grid">
              <header className="slds-media slds-media_center slds-has-flexi-truncate">
                <div className="slds-media__figure" style={{ marginRight: '0.75rem' }}>
                  <span className="slds-icon_container slds-icon-standard-user" style={{ fontSize: '18px' }}>👤</span>
                </div>
                <div className="slds-media__body">
                  <h2 className="slds-card__header-title">
                    <span className="slds-card__header-link slds-truncate font-semibold" style={{ fontSize: '1.05rem', fontWeight: 'bold' }}>
                      Active Administrator Session
                    </span>
                  </h2>
                </div>
              </header>
            </div>
            <div className="slds-card__body slds-card__body_inner">
              <div className="slds-grid slds-wrap" style={{ gap: '24px' }}>
                <div>
                  <p className="slds-text-title" style={{ fontSize: '11px', textTransform: 'uppercase', color: '#514f4d' }}>Name</p>
                  <p className="slds-text-body_regular font-medium" style={{ fontSize: '14px', fontWeight: 'bold' }}>{session?.user.vrchatUsername ?? session?.user.name}</p>
                </div>
                <div>
                  <p className="slds-text-title" style={{ fontSize: '11px', textTransform: 'uppercase', color: '#514f4d' }}>Authorization Role</p>
                  <span className="slds-badge slds-theme_success" style={{ padding: '2px 10px', fontSize: '11px', borderRadius: '4px', background: '#2e7d32', color: '#fff' }}>
                    {session?.user.siteRole ?? 'SITE_ADMIN'}
                  </span>
                </div>
              </div>
            </div>
          </article>
        </div>

        {/* Section Cards */}
        <div className="slds-col slds-size_1-of-1 slds-medium-size_1-of-3 slds-m-bottom_medium">
          <article className="slds-card" style={{ height: '100%', border: '1px solid #dddbda', display: 'flex', flexDirection: 'column' }}>
            <div className="slds-card__header slds-grid">
              <header className="slds-media slds-media_center slds-has-flexi-truncate">
                <div className="slds-media__figure" style={{ marginRight: '0.75rem' }}>
                  <span className="slds-icon_container slds-icon-standard-event" style={{ fontSize: '20px' }}>🏆</span>
                </div>
                <div className="slds-media__body">
                  <h2 className="slds-card__header-title">
                    <span className="slds-card__header-link slds-truncate font-semibold" style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>
                      Events & Race Management
                    </span>
                  </h2>
                </div>
              </header>
            </div>
            <div className="slds-card__body slds-card__body_inner" style={{ flexGrow: 1 }}>
              <p className="slds-text-body_regular slds-m-bottom_medium" style={{ color: '#514f4d' }}>
                View complete details for competition events. Register event participants, configure race events, and update race results in real-time or batch format.
              </p>
            </div>
            <footer className="slds-card__footer" style={{ borderTop: '1px solid #f3f2f1', padding: '0.75rem 1rem' }}>
              <Link to="/admin/events" className="slds-button slds-button_brand" style={{ width: '100%', textAlign: 'center', display: 'block', textDecoration: 'none' }}>
                Manage Events
              </Link>
            </footer>
          </article>
        </div>

        <div className="slds-col slds-size_1-of-1 slds-medium-size_1-of-3 slds-m-bottom_medium">
          <article className="slds-card" style={{ height: '100%', border: '1px solid #dddbda', display: 'flex', flexDirection: 'column' }}>
            <div className="slds-card__header slds-grid">
              <header className="slds-media slds-media_center slds-has-flexi-truncate">
                <div className="slds-media__figure" style={{ marginRight: '0.75rem' }}>
                  <span className="slds-icon_container slds-icon-standard-approval" style={{ fontSize: '20px' }}>📋</span>
                </div>
                <div className="slds-media__body">
                  <h2 className="slds-card__header-title">
                    <span className="slds-card__header-link slds-truncate font-semibold" style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>
                      Pending Approvals
                    </span>
                  </h2>
                </div>
              </header>
            </div>
            <div className="slds-card__body slds-card__body_inner" style={{ flexGrow: 1 }}>
              <p className="slds-text-body_regular slds-m-bottom_medium" style={{ color: '#514f4d' }}>
                Review pending organization and competitive team registration applications submitted by community members.
              </p>
            </div>
            <footer className="slds-card__footer" style={{ borderTop: '1px solid #f3f2f1', padding: '0.75rem 1rem' }}>
              <Link to="/admin/approvals" className="slds-button slds-button_neutral" style={{ width: '100%', textAlign: 'center', display: 'block', textDecoration: 'none' }}>
                Review Queue
              </Link>
            </footer>
          </article>
        </div>

        <div className="slds-col slds-size_1-of-1 slds-medium-size_1-of-3 slds-m-bottom_medium">
          <article className="slds-card" style={{ height: '100%', border: '1px solid #dddbda', display: 'flex', flexDirection: 'column' }}>
            <div className="slds-card__header slds-grid">
              <header className="slds-media slds-media_center slds-has-flexi-truncate">
                <div className="slds-media__figure" style={{ marginRight: '0.75rem' }}>
                  <span className="slds-icon_container slds-icon-standard-people" style={{ fontSize: '20px' }}>👥</span>
                </div>
                <div className="slds-media__body">
                  <h2 className="slds-card__header-title">
                    <span className="slds-card__header-link slds-truncate font-semibold" style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>
                      User Administration
                    </span>
                  </h2>
                </div>
              </header>
            </div>
            <div className="slds-card__body slds-card__body_inner" style={{ flexGrow: 1 }}>
              <p className="slds-text-body_regular slds-m-bottom_medium" style={{ color: '#514f4d' }}>
                Lookup platform user accounts, view skill class tier parameters, check team affiliations, and modify administrative system access.
              </p>
            </div>
            <footer className="slds-card__footer" style={{ borderTop: '1px solid #f3f2f1', padding: '0.75rem 1rem' }}>
              <Link to="/admin/users" className="slds-button slds-button_neutral" style={{ width: '100%', textAlign: 'center', display: 'block', textDecoration: 'none' }}>
                Manage Users
              </Link>
            </footer>
          </article>
        </div>

        <div className="slds-col slds-size_1-of-1 slds-medium-size_1-of-3 slds-m-bottom_medium">
          <article className="slds-card" style={{ height: '100%', border: '1px solid #dddbda', display: 'flex', flexDirection: 'column' }}>
            <div className="slds-card__header slds-grid">
              <header className="slds-media slds-media_center slds-has-flexi-truncate">
                <div className="slds-media__figure" style={{ marginRight: '0.75rem' }}>
                  <span className="slds-icon_container slds-icon-standard-groups" style={{ fontSize: '20px' }}>👥</span>
                </div>
                <div className="slds-media__body">
                  <h2 className="slds-card__header-title">
                    <span className="slds-card__header-link slds-truncate font-semibold" style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>
                      Teams & Organizations
                    </span>
                  </h2>
                </div>
              </header>
            </div>
            <div className="slds-card__body slds-card__body_inner" style={{ flexGrow: 1 }}>
              <p className="slds-text-body_regular slds-m-bottom_medium" style={{ color: '#514f4d' }}>
                Register and oversee competitive teams and organizations. Track demographics, update statistics, and manage team member rosters and roles.
              </p>
            </div>
            <footer className="slds-card__footer" style={{ borderTop: '1px solid #f3f2f1', padding: '0.75rem 1rem' }}>
              <Link to="/admin/teams" className="slds-button slds-button_neutral" style={{ width: '100%', textAlign: 'center', display: 'block', textDecoration: 'none' }}>
                Manage Teams
              </Link>
            </footer>
          </article>
        </div>

        {isSiteAdmin && (
          <div className="slds-col slds-size_1-of-1 slds-medium-size_1-of-3 slds-m-bottom_medium">
            <article className="slds-card" style={{ height: '100%', border: '1px solid #dddbda', display: 'flex', flexDirection: 'column' }}>
              <div className="slds-card__header slds-grid">
                <header className="slds-media slds-media_center slds-has-flexi-truncate">
                  <div className="slds-media__figure" style={{ marginRight: '0.75rem' }}>
                    <span className="slds-icon_container slds-icon-standard-metrics" style={{ fontSize: '20px' }}>📊</span>
                  </div>
                  <div className="slds-media__body">
                    <h2 className="slds-card__header-title">
                      <span className="slds-card__header-link slds-truncate font-semibold" style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>
                        Rating System Backfill
                      </span>
                    </h2>
                  </div>
                </header>
              </div>
              <div className="slds-card__body slds-card__body_inner" style={{ flexGrow: 1 }}>
                <p className="slds-text-body_regular slds-m-bottom_small" style={{ color: '#514f4d' }}>
                  Replay all historical race results chronologically using Glicko-2 to compute and persist participant ratings and per-race rating deltas.
                </p>
                {recalcMessage && (
                  <div className="slds-box slds-box_x-small slds-theme_success slds-m-top_small" style={{ fontSize: '12px' }}>
                    {recalcMessage}
                  </div>
                )}
                {recalcError && (
                  <div className="slds-box slds-box_x-small slds-theme_error slds-m-top_small" style={{ fontSize: '12px' }}>
                    {recalcError}
                  </div>
                )}
              </div>
              <footer className="slds-card__footer" style={{ borderTop: '1px solid #f3f2f1', padding: '0.75rem 1rem' }}>
                <button
                  type="button"
                  onClick={handleRecalculateRatings}
                  disabled={recalcLoading}
                  className="slds-button slds-button_brand"
                  style={{ width: '100%' }}
                >
                  {recalcLoading ? 'Recalculating Ratings...' : 'Recalculate All Ratings'}
                </button>
              </footer>
            </article>
          </div>
        )}
      </div>
    </AdminLayout>
  )
}

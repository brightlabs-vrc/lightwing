import { Link, createFileRoute } from '@tanstack/react-router'
import { useAuth } from '../../hooks/useAuth'
import { requireSiteAdmin } from '../../lib/auth-guard'
import { AdminLayout } from './-AdminLayout'
import { SldsIcon } from '../../components/SldsIcon'

export const Route = createFileRoute('/admin/')({
  beforeLoad: async ({ location }) => {
    await requireSiteAdmin(location)
  },
  component: AdminPage,
})

function AdminPage() {
  const { session } = useAuth()

  return (
    <AdminLayout
      title="Admin Dashboard"
      subtitle="Welcome to the Project Lightwing control center. Oversee system entities, manage dynamic event results, and verify ingestion pipelines."
    >
      <div className="slds-grid slds-wrap slds-gutters">
        {/* Active Session summary card */}
        <div className="slds-col slds-size_1-of-1 slds-m-bottom_large">
          <article className="slds-card" style={{ border: '1px solid #dddbda', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
            <div className="slds-card__header slds-grid">
              <header className="slds-media slds-media_center slds-has-flexi-truncate">
                <div className="slds-media__figure" style={{ marginRight: '0.75rem' }}>
                  <SldsIcon category="standard" name="user" size={24} />
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
                  <p className="slds-text-body_regular font-medium" style={{ fontSize: '14px', fontWeight: 'bold' }}>{session?.user.name}</p>
                </div>
                <div>
                  <p className="slds-text-title" style={{ fontSize: '11px', textTransform: 'uppercase', color: '#514f4d' }}>Email</p>
                  <p className="slds-text-body_regular" style={{ fontSize: '14px' }}>{session?.user.email}</p>
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
                  <SldsIcon category="standard" name="event" size={28} />
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
                  <SldsIcon category="standard" name="people" size={28} />
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
                  <SldsIcon category="standard" name="dataset" size={28} />
                </div>
                <div className="slds-media__body">
                  <h2 className="slds-card__header-title">
                    <span className="slds-card__header-link slds-truncate font-semibold" style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>
                      Dataset Records
                    </span>
                  </h2>
                </div>
              </header>
            </div>
            <div className="slds-card__body slds-card__body_inner" style={{ flexGrow: 1 }}>
              <p className="slds-text-body_regular slds-m-bottom_medium" style={{ color: '#514f4d' }}>
                Per-event dataset imports are being finalized. Open an event and use its Datasets tab to track record ingestion once available.
              </p>
            </div>
            <footer className="slds-card__footer" style={{ borderTop: '1px solid #f3f2f1', padding: '0.75rem 1rem' }}>
              <Link to="/admin/events" className="slds-button slds-button_neutral" style={{ width: '100%', textAlign: 'center', display: 'block', textDecoration: 'none' }}>
                Manage Events
              </Link>
            </footer>
          </article>
        </div>
      </div>
    </AdminLayout>
  )
}

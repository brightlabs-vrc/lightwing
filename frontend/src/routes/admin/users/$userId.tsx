import { createFileRoute, Link } from '@tanstack/react-router'
import { useAuth } from '../../../hooks/useAuth'
import { requireSiteAdmin } from '../../../lib/auth-guard'
import { AdminLayout } from '../-AdminLayout'

export const Route = createFileRoute('/admin/users/$userId')({
  beforeLoad: async ({ location }) => {
    await requireSiteAdmin(location)
  },
  component: AdminUserDetailPage,
})

function AdminUserDetailPage() {
  const { userId } = Route.useParams()
  const { session } = useAuth()
  const isCurrentUser = session?.user.id === userId

  return (
    <AdminLayout
      title="User Profile Detail"
      subtitle={`Displaying system profile parameters for user reference: ${userId}`}
    >
      <div className="slds-grid slds-wrap slds-gutters">
        <div className="slds-col slds-size_1-of-1 slds-medium-size_2-of-3">
          <article className="slds-card" style={{ border: '1px solid #dddbda' }}>
            <div className="slds-card__header slds-grid">
              <header className="slds-media slds-media_center slds-has-flexi-truncate">
                <div className="slds-media__figure" style={{ marginRight: '0.5rem' }}>
                  <span className="slds-icon_container slds-icon-standard-contact" style={{ fontSize: '18px' }}>👤</span>
                </div>
                <div className="slds-media__body">
                  <h2 className="slds-card__header-title">
                    <span className="slds-card__header-link slds-truncate font-semibold" style={{ fontWeight: 'bold' }}>
                      Participant Parameters
                    </span>
                  </h2>
                </div>
              </header>
            </div>

            <div className="slds-card__body slds-card__body_inner" style={{ padding: '1.5rem' }}>
              {isCurrentUser ? (
                <div className="slds-box slds-theme_shade" style={{ background: '#f8fafc', border: '1px solid #dddbda', borderRadius: '4px', padding: '1.5rem' }}>
                  <div className="slds-grid slds-wrap slds-gutters">
                    <div className="slds-col slds-size_1-of-1 slds-medium-size_1-of-2 slds-m-bottom_small">
                      <p className="slds-text-title text-slate-500" style={{ fontSize: '11px', textTransform: 'uppercase' }}>Full Name</p>
                      <p className="slds-text-body_regular font-bold" style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>{session?.user.name}</p>
                    </div>
                    <div className="slds-col slds-size_1-of-1 slds-medium-size_1-of-2 slds-m-bottom_small">
                      <p className="slds-text-title text-slate-500" style={{ fontSize: '11px', textTransform: 'uppercase' }}>Email Address</p>
                      <p className="slds-text-body_regular" style={{ fontSize: '1.1rem' }}>{session?.user.email}</p>
                    </div>
                    <div className="slds-col slds-size_1-of-1 slds-medium-size_1-of-2 slds-m-bottom_small">
                      <p className="slds-text-title text-slate-500" style={{ fontSize: '11px', textTransform: 'uppercase' }}>System Site Role</p>
                      <span className="slds-badge slds-theme_success" style={{ padding: '2px 10px', borderRadius: '4px', background: '#2e7d32', color: '#fff' }}>
                        {session?.user.siteRole ?? 'USER'}
                      </span>
                    </div>
                    <div className="slds-col slds-size_1-of-1 slds-medium-size_1-of-2 slds-m-bottom_small">
                      <p className="slds-text-title text-slate-500" style={{ fontSize: '11px', textTransform: 'uppercase' }}>Active Competitor ID</p>
                      <code className="text-xs" style={{ fontSize: '12px' }}>{session?.user.id}</code>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="slds-align_absolute-center slds-p-around_large text-slate-500" style={{ border: '1px dashed #dddbda', borderRadius: '4px', textAlign: 'center' }}>
                  <p>This dynamic detail panel can only display detailed profiling for the currently authenticated administrator user session right now.</p>
                  <p className="slds-m-top_small text-xs">Use the search utility in the <Link to="/admin/users" className="text-blue-600 hover:underline font-bold">User Directory</Link> to query other account structures.</p>
                </div>
              )}
            </div>

            <footer className="slds-card__footer" style={{ borderTop: '1px solid #f3f2f1', padding: '1rem' }}>
              <Link to="/admin/users" className="slds-button slds-button_neutral" style={{ textDecoration: 'none' }}>
                Back to User Directory
              </Link>
            </footer>
          </article>
        </div>
      </div>
    </AdminLayout>
  )
}

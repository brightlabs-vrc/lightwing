import { Link, createFileRoute } from '@tanstack/react-router'
import { useAuth } from '../../hooks/useAuth'
import { requireSiteAdmin } from '../../lib/auth-guard'
import { AdminLayout } from './-AdminLayout'
import { Heading, Text, Label, Button } from '@primer/react'

export const Route = createFileRoute('/admin/')({
  beforeLoad: async ({ location }) => {
    await requireSiteAdmin(location)
  },
  component: AdminPage,
})

function AdminPage() {
  const { session } = useAuth()

  return (
    <AdminLayout>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {/* Active Session summary card */}
        <div style={{
          padding: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
          border: '1px solid var(--color-border-default)',
          borderRadius: '6px',
          backgroundColor: 'var(--color-canvas-default)',
          boxShadow: 'var(--color-shadow-small)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '20px' }}>👤</span>
            <Heading as="h2" style={{ fontSize: '18px', margin: 0 }}>
              Active Administrator Session
            </Heading>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2rem' }}>
            <div>
              <span style={{ fontSize: '11px', textTransform: 'uppercase', color: '#57606a', fontWeight: 'bold', display: 'block', marginBottom: '0.25rem' }}>Name</span>
              <span style={{ fontSize: '14px', fontWeight: 'bold' }}>{session?.user.name}</span>
            </div>
            <div>
              <span style={{ fontSize: '11px', textTransform: 'uppercase', color: '#57606a', fontWeight: 'bold', display: 'block', marginBottom: '0.25rem' }}>Authorization Role</span>
              <Label variant="success">
                {session?.user.siteRole ?? 'SITE_ADMIN'}
              </Label>
            </div>
          </div>
        </div>

        {/* Section Cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '1.5rem'
        }}>
          {/* Events */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            border: '1px solid var(--color-border-default)',
            borderRadius: '6px',
            backgroundColor: 'var(--color-canvas-default)',
            boxShadow: 'var(--color-shadow-small)',
            overflow: 'hidden'
          }}>
            <div style={{ padding: '1.5rem', flexGrow: 1, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ fontSize: '24px' }}>🏆</span>
                <Heading as="h3" style={{ fontSize: '18px', margin: 0 }}>
                  Events & Race Management
                </Heading>
              </div>
              <span style={{ color: '#57606a', fontSize: '14px', lineHeight: '1.5' }}>
                View complete details for competition events. Register event participants, configure race events, and update race results in real-time or batch format.
              </span>
            </div>
            <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--color-border-default)', backgroundColor: 'var(--color-canvas-subtle)' }}>
              <Button as={Link} to="/admin/events" variant="primary" style={{ width: '100%', textAlign: 'center' }}>
                Manage Events
              </Button>
            </div>
          </div>

          {/* Users */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            border: '1px solid var(--color-border-default)',
            borderRadius: '6px',
            backgroundColor: 'var(--color-canvas-default)',
            boxShadow: 'var(--color-shadow-small)',
            overflow: 'hidden'
          }}>
            <div style={{ padding: '1.5rem', flexGrow: 1, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ fontSize: '24px' }}>👥</span>
                <Heading as="h3" style={{ fontSize: '18px', margin: 0 }}>
                  User Administration
                </Heading>
              </div>
              <span style={{ color: '#57606a', fontSize: '14px', lineHeight: '1.5' }}>
                Lookup platform user accounts, view skill class tier parameters, check team affiliations, and modify administrative system access.
              </span>
            </div>
            <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--color-border-default)', backgroundColor: 'var(--color-canvas-subtle)' }}>
              <Button as={Link} to="/admin/users" style={{ width: '100%', textAlign: 'center' }}>
                Manage Users
              </Button>
            </div>
          </div>

          {/* Teams */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            border: '1px solid var(--color-border-default)',
            borderRadius: '6px',
            backgroundColor: 'var(--color-canvas-default)',
            boxShadow: 'var(--color-shadow-small)',
            overflow: 'hidden'
          }}>
            <div style={{ padding: '1.5rem', flexGrow: 1, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ fontSize: '24px' }}>🛡️</span>
                <Heading as="h3" style={{ fontSize: '18px', margin: 0 }}>
                  Teams & Organizations
                </Heading>
              </div>
              <span style={{ color: '#57606a', fontSize: '14px', lineHeight: '1.5' }}>
                Register and oversee competitive teams and organizations. Track demographics, update statistics, and manage team member rosters and roles.
              </span>
            </div>
            <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--color-border-default)', backgroundColor: 'var(--color-canvas-subtle)' }}>
              <Button as={Link} to="/admin/teams" style={{ width: '100%', textAlign: 'center' }}>
                Manage Teams
              </Button>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}

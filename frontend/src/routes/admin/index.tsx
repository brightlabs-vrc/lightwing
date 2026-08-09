import { Link, createFileRoute } from '@tanstack/react-router'
import { useAuth } from '../../hooks/useAuth'
import { requireSiteAdmin } from '../../lib/auth-guard'
import { AdminLayout } from './-AdminLayout'
import { listAdminEvents, listAdminUsers, listAdminTeams } from '../../lib/admin-api'
import { AlertBanner } from '../../components/AlertBanner'
import { Heading, Label, Button, Spinner } from '@primer/react'
import { TrophyIcon, ShieldIcon, PeopleIcon, PersonIcon } from '@primer/octicons-react'
import { useEffect, useState } from 'react'
import { MOCK_MODE } from '../../lib/mock-mode'

interface StatCardProps {
  label: string
  value: number
  icon: JSX.Element
}

function StatCard({ label, value, icon }: StatCardProps) {
  return (
    <div style={{
      border: '1px solid var(--color-border-default)',
      borderRadius: '6px',
      backgroundColor: 'var(--color-canvas-default)',
      boxShadow: 'var(--color-shadow-small)',
      padding: '1.25rem',
      display: 'flex',
      alignItems: 'center',
      gap: '0.75rem',
    }}>
      <span style={{ fontSize: '24px', display: 'flex', alignItems: 'center' }}>{icon}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--color-fg-muted)', fontWeight: 'bold', marginBottom: '0.25rem' }}>
          {label}
        </div>
        <div style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--color-fg-default)' }}>
          {value}
        </div>
      </div>
    </div>
  )
}

export const Route = createFileRoute('/admin/')({
  beforeLoad: async ({ location }) => {
    await requireSiteAdmin(location)
  },
  component: AdminPage,
})

function AdminPage() {
  const { session } = useAuth()
  const authHeader = session?.session.token ? `Bearer ${session.session.token}` : ''
  const [stats, setStats] = useState<{
    events: number
    users: number
    teams: number
    loading: boolean
    error: string | null
  }>({ events: 0, users: 0, teams: 0, loading: true, error: null })

  useEffect(() => {
    async function loadStats() {
      setStats(s => ({ ...s, loading: true, error: null }))
      try {
        const [eventsRes, usersRes, teamsRes] = await Promise.all([
          listAdminEvents(undefined, undefined, 1, 0),
          listAdminUsers(authHeader, undefined, 1, 0),
          listAdminTeams(undefined, 1, 0),
        ])
        setStats({
          events: eventsRes.total,
          users: usersRes.total,
          teams: teamsRes.total,
          loading: false,
          error: null,
        })
      } catch (err) {
        setStats(s => ({ ...s, loading: false, error: err instanceof Error ? err.message : 'Failed to load stats' }))
      }
    }
    void loadStats()
  }, [authHeader])

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
            <span style={{ fontSize: '20px' }}><PersonIcon /></span>
            <Heading as="h2" style={{ fontSize: '18px', margin: 0 }}>
              Active Administrator Session
            </Heading>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2rem' }}>
            <div>
              <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--color-fg-muted)', fontWeight: 'bold', display: 'block', marginBottom: '0.25rem' }}>Name</span>
              <span style={{ fontSize: '14px', fontWeight: 'bold' }}>{session?.user.vrchatUsername ?? session?.user.name}</span>
            </div>
            <div>
              <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--color-fg-muted)', fontWeight: 'bold', display: 'block', marginBottom: '0.25rem' }}>Authorization Role</span>
              <Label variant="success">
                {session?.user.siteRole ?? 'SITE_ADMIN'}
              </Label>
            </div>
          </div>
        </div>

        {/* System Statistics Cards */}
        {stats.error && (
          <AlertBanner variant="error">{stats.error}</AlertBanner>
        )}
        {stats.loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '2rem', gap: '0.5rem', color: 'var(--color-fg-muted)' }}>
            <Spinner size="small" />
            <span>Loading system statistics...</span>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '1rem',
          }}>
            <StatCard
              label="Competition Events"
              value={stats.events}
              icon={<TrophyIcon />}
            />
            <StatCard
              label="Registered Users"
              value={stats.users}
              icon={<PeopleIcon />}
            />
            <StatCard
              label="Organization Teams"
              value={stats.teams}
              icon={<ShieldIcon />}
            />
          </div>
        )}

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
                <span style={{ fontSize: '20px' }}><TrophyIcon /></span>
                <Heading as="h3" style={{ fontSize: '18px', margin: 0 }}>
                  Events & Race Management
                </Heading>
              </div>
              <span style={{ color: 'var(--color-fg-muted)', fontSize: '14px', lineHeight: '1.5' }}>
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
                <span style={{ fontSize: '20px' }}><PeopleIcon /></span>
                <Heading as="h3" style={{ fontSize: '18px', margin: 0 }}>
                  User Administration
                </Heading>
              </div>
              <span style={{ color: 'var(--color-fg-muted)', fontSize: '14px', lineHeight: '1.5' }}>
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
                <span style={{ fontSize: '20px' }}><ShieldIcon /></span>
                <Heading as="h3" style={{ fontSize: '18px', margin: 0 }}>
                  Teams & Organizations
                </Heading>
              </div>
              <span style={{ color: 'var(--color-fg-muted)', fontSize: '14px', lineHeight: '1.5' }}>
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

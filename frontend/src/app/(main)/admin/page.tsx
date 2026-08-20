import { requireSiteAdmin } from '@/lib/auth-guard'
import { listAdminEvents, listAdminUsers, listAdminTeams } from '@/lib/admin-api'
import { AdminLayout } from '@/components/Admin/AdminLayout'
import { AlertBanner } from '@/components/AlertBanner'
import { TrophyIcon, ShieldIcon, PeopleIcon } from '@primer/octicons-react'
import { Heading, Label, Button, Spinner } from '@primer/react'
import Link from 'next/link'

function StatCard({ label, value, icon, href }: { label: string; value: number; icon: React.ReactNode; href: string }) {
  return (
    <Link href={href} style={{ textDecoration: 'none', color: 'inherit' }}>
      <div
        style={{
          border: '1px solid var(--color-border-default)',
          borderRadius: '6px',
          backgroundColor: 'var(--color-canvas-default)',
          boxShadow: 'var(--color-shadow-small)',
          padding: '1.25rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          transition: 'background 0.2s',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--color-canvas-subtle)' }}
        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'var(--color-canvas-default)' }}
      >
        <span style={{ fontSize: '24px' }}>{icon}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--color-fg-muted)', fontWeight: 'bold', marginBottom: '0.25rem' }}>
            {label}
          </div>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--color-fg-default)' }}>
            {value}
          </div>
        </div>
      </div>
    </Link>
  )
}

export default async function AdminDashboardPage() {
  const session = await requireSiteAdmin()
  const authHeader = "Bearer " + session.session.token

  const [eventsResult, usersResult, teamsResult] = await Promise.all([
    listAdminEvents(undefined, undefined, 1, 0),
    listAdminUsers(authHeader, undefined, 1, 0),
    listAdminTeams(undefined, 1, 0),
  ])

  return (
    <AdminLayout>
      <div style={{ padding: '2rem' }}>
        <div style={{ marginBottom: '2rem' }}>
          <Heading as="h1" style={{ fontSize: '24px', marginBottom: '0.5rem' }}>Admin Dashboard</Heading>
          <Label>Manage events, users, and teams</Label>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
          <StatCard label="Events" value={eventsResult.total} icon={<TrophyIcon size={24} />} href="/admin/events" />
          <StatCard label="Users" value={usersResult.total} icon={<PeopleIcon size={24} />} href="/admin/users" />
          <StatCard label="Teams" value={teamsResult.total} icon={<ShieldIcon size={24} />} href="/admin/teams" />
        </div>

        <div style={{ display: 'flex', gap: '1rem' }}>
          <Link href="/admin/events" style={{ textDecoration: 'none' }}>
            <Button variant="primary">Manage Events</Button>
          </Link>
          <Link href="/admin/users" style={{ textDecoration: 'none' }}>
            <Button>Manage Users</Button>
          </Link>
          <Link href="/admin/teams" style={{ textDecoration: 'none' }}>
            <Button>Manage Teams</Button>
          </Link>
        </div>
      </div>
    </AdminLayout>
  )
}

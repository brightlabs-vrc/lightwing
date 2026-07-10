import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { useAuth } from '../../../hooks/useAuth'
import { requireSiteAdmin } from '../../../lib/admin-guard'
import { getAdminUserProfile, updateAdminUserSiteRole } from '../../../lib/admin-api'
import type { auth } from '../../../lib/client'

export const Route = createFileRoute('/admin/users/')({
  beforeLoad: async ({ location }) => {
    await requireSiteAdmin(location)
  },
  component: AdminUsersPage,
})

function AdminUsersPage() {
  const navigate = useNavigate()
  const { session } = useAuth()
  const [selectedUserId, setSelectedUserId] = useState('')
  const [profile, setProfile] = useState<auth.UserProfile | null>(null)
  const [loading, setLoading] = useState(false)
  const [updatingRole, setUpdatingRole] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const authHeader = useMemo(() => {
    const token = session?.session.token
    return token ? `Bearer ${token}` : null
  }, [session?.session.token])

  const currentUserId = session?.user.id ?? ''

  const users = [
    {
      id: currentUserId,
      role: session?.user.siteRole ?? 'USER',
      label: `${session?.user.name ?? 'Current user'} (you)`,
    },
  ].filter((user) => user.id)

  async function lookupUser() {
    if (!selectedUserId.trim()) {
      setError('Enter a user ID to continue.')
      return
    }

    setLoading(true)
    setError(null)
    try {
      const loaded = await getAdminUserProfile(selectedUserId.trim())
      setProfile(loaded)
    } catch (cause) {
      setProfile(null)
      setError(cause instanceof Error ? cause.message : 'Unable to fetch user profile')
    } finally {
      setLoading(false)
    }
  }

  async function setSiteRole(siteRole: auth.SiteRoleName) {
    if (!profile) {
      return
    }

    if (!authHeader) {
      setError('Missing auth session token. Re-authenticate from /auth and try again.')
      return
    }

    setUpdatingRole(true)
    setError(null)
    try {
      const updated = await updateAdminUserSiteRole(profile.id, siteRole, authHeader)
      setProfile(updated)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to update site role')
    } finally {
      setUpdatingRole(false)
    }
  }

  return (
    <section className='space-y-6'>
      <header className='space-y-2'>
        <h1 className='text-3xl font-bold tracking-tight text-slate-900'>User Management</h1>
        <p className='text-sm text-slate-600'>
        This view currently exposes authenticated administrative users derived from the active
        session. As user management endpoints grow, this list can expand to all users.
        </p>
      </header>

      <div className='rounded-xl border border-slate-200 bg-white p-4 shadow-sm'>
        <h2 className='mb-3 text-base font-semibold text-slate-900'>Quick Access</h2>
        <ul className='space-y-2 text-sm'>
        {users.map((user) => (
          <li key={user.id}>
            <button
              type='button'
              onClick={() =>
                navigate({
                  to: '/admin/users/$userId',
                  params: { userId: user.id },
                })
              }
              className='font-medium text-sky-700 hover:text-sky-800'
            >
              {user.label} - {user.role}
            </button>
          </li>
        ))}
        </ul>
      </div>

      <div className='rounded-xl border border-slate-200 bg-white p-4 shadow-sm'>
        <h2 className='mb-3 text-base font-semibold text-slate-900'>Lookup and Role Controls</h2>
        <div className='flex flex-col gap-3 md:flex-row'>
          <input
            value={selectedUserId}
            onChange={(evt) => setSelectedUserId(evt.target.value)}
            placeholder='Enter user ID (for example: user_123)'
            className='w-full rounded-md border border-slate-300 px-3 py-2 text-sm'
          />
          <button
            type='button'
            onClick={() => {
              void lookupUser()
            }}
            disabled={loading}
            className='rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50'
          >
            {loading ? 'Loading...' : 'Lookup'}
          </button>
        </div>

        {error ? <p className='mt-3 text-sm text-red-700'>{error}</p> : null}

        {profile ? (
          <div className='mt-4 space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4'>
            <p className='text-sm'><span className='font-semibold'>Name:</span> {profile.name}</p>
            <p className='text-sm'><span className='font-semibold'>Email:</span> {profile.email}</p>
            <p className='text-sm'><span className='font-semibold'>Role:</span> {profile.siteRole}</p>
            <div className='flex flex-wrap gap-2'>
              <button
                type='button'
                onClick={() => {
                  void setSiteRole('SITE_ADMIN')
                }}
                disabled={updatingRole || profile.siteRole === 'SITE_ADMIN'}
                className='rounded-md border border-emerald-300 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50'
              >
                Grant SITE_ADMIN
              </button>
              <button
                type='button'
                onClick={() => {
                  void setSiteRole('USER')
                }}
                disabled={updatingRole || profile.siteRole === 'USER'}
                className='rounded-md border border-amber-300 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-50'
              >
                Revoke to USER
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <Link to='/admin' className='text-sm font-medium text-sky-700 hover:text-sky-800'>
        Back to Admin Dashboard
      </Link>
    </section>
  )
}

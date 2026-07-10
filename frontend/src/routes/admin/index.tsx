import { Link, createFileRoute } from '@tanstack/react-router'
import { useAuth } from '../../hooks/useAuth'
import { requireSiteAdmin } from '../../lib/admin-guard'

export const Route = createFileRoute('/admin/')({
  beforeLoad: async ({ location }) => {
    await requireSiteAdmin(location)
  },
  component: AdminPage,
})

function AdminPage() {
  const { session } = useAuth()

  return (
    <section className='space-y-6'>
      <header className='space-y-2'>
        <h1 className='text-3xl font-bold tracking-tight text-slate-900'>Admin Dashboard</h1>
        <p className='text-sm text-slate-600'>
          Central operations view for events, users, and dataset record workflows.
        </p>
      </header>

      <div className='rounded-xl border border-slate-200 bg-white p-4 shadow-sm'>
        <p className='text-sm text-slate-700'>
          <span className='font-semibold'>Signed in:</span> {session?.user.name} ({session?.user.email})
        </p>
        <p className='text-sm text-slate-700'>
          <span className='font-semibold'>Role:</span> {session?.user.siteRole ?? 'USER'}
        </p>
      </div>

      <div className='grid gap-4 md:grid-cols-3'>
        <Link
          to='/admin/events'
          className='rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow'
        >
          <h2 className='text-lg font-semibold text-slate-900'>Events</h2>
          <p className='mt-2 text-sm text-slate-600'>
            Inspect and update event lifecycle status across the competition system.
          </p>
        </Link>

        <Link
          to='/admin/users'
          className='rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow'
        >
          <h2 className='text-lg font-semibold text-slate-900'>Users</h2>
          <p className='mt-2 text-sm text-slate-600'>
            Find users, review profile details, and grant or revoke site admin access.
          </p>
        </Link>

        <Link
          to='/admin/datasets'
          className='rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow'
        >
          <h2 className='text-lg font-semibold text-slate-900'>Dataset Records</h2>
          <p className='mt-2 text-sm text-slate-600'>
            Monitor ingest records and operational pipeline state.
          </p>
        </Link>
      </div>
    </section>
  )
}

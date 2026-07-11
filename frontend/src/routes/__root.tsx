import { createRootRoute, Link, Outlet, useRouterState } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/router-devtools'
import { useAuth } from '../hooks/useAuth'

export const Route = createRootRoute({
  component: RootLayout,
})

function RootLayout() {
  const { session, loading, signOutUser } = useAuth()
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const isAdminArea = pathname.startsWith('/admin')
  const isSiteAdmin = session?.user.siteRole === 'SITE_ADMIN'

  if (isAdminArea) {
    return (
      <>
        <Outlet />
        <TanStackRouterDevtools position='bottom-right' />
      </>
    )
  }

  return (
    <>
      <div className='min-h-screen bg-slate-50 text-slate-900'>
      <header className='border-b border-slate-200 bg-white/95 backdrop-blur'>
        <nav className='mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-4 text-sm'>
          <Link to='/' activeProps={{ className: 'font-semibold text-slate-900' }} className='text-slate-600 hover:text-slate-900'>Home</Link>
          <Link to='/dashboard' activeProps={{ className: 'font-semibold text-slate-900' }} className='text-slate-600 hover:text-slate-900'>Dashboard</Link>
          <Link to='/auth' activeProps={{ className: 'font-semibold text-slate-900' }} className='text-slate-600 hover:text-slate-900'>Auth</Link>
          {isSiteAdmin ? (
            <Link to='/admin' activeProps={{ className: 'font-semibold text-slate-900' }} className='text-slate-600 hover:text-slate-900'>
              Admin Portal
            </Link>
          ) : null}
          <div className='ml-auto flex items-center gap-2 text-xs text-slate-600'>
            {loading ? <span>Checking auth...</span> : null}
            {!loading && session ? (
              <>
                <span>{session.user.name} ({session.user.siteRole ?? 'USER'})</span>
                <button type='button' onClick={() => void signOutUser()} className='rounded-md border border-slate-300 bg-white px-2 py-1 font-medium text-slate-700 hover:bg-slate-50'>Sign out</button>
              </>
            ) : null}
            {!loading && !session ? <span>Not signed in</span> : null}
          </div>
        </nav>
      </header>
      <main className='mx-auto max-w-6xl px-4 py-6'>
        <Outlet />
      </main>
      <footer className='mx-auto max-w-6xl px-4 pb-8 text-sm text-slate-500'>
        TanStack Router + Vite file-based routing
      </footer>
      </div>
      <TanStackRouterDevtools position='bottom-right' />
    </>
  )
}

import { createRootRoute, Link, Outlet } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/router-devtools'

export const Route = createRootRoute({
  component: RootLayout,
})

function RootLayout() {
  return (
    <>
      <header style={{ borderBottom: '1px solid #e5e7eb', background: '#fafaf9' }}>
        <nav style={{ display: 'flex', gap: '0.75rem', padding: '1rem', maxWidth: 960, margin: '0 auto' }}>
          <Link to='/' activeProps={{ style: { fontWeight: 'bold' } }}>Home</Link>
          <Link to='/dashboard' activeProps={{ style: { fontWeight: 'bold' } }}>Dashboard</Link>
          <Link to='/admin' activeProps={{ style: { fontWeight: 'bold' } }}>Admin</Link>
          <Link to='/admin/users' activeProps={{ style: { fontWeight: 'bold' } }}>Users</Link>
          <Link to='/admin/users/$userId' params={{ userId: 'u_001' }} activeProps={{ style: { fontWeight: 'bold' } }}>
            User Detail
          </Link>
        </nav>
      </header>
      <main style={{ padding: '1rem', maxWidth: 960, margin: '0 auto' }}>
        <Outlet />
      </main>
      <footer style={{ padding: '1rem', maxWidth: 960, margin: '0 auto', color: '#64748b' }}>
        TanStack Router + Vite file-based routing
      </footer>
      <TanStackRouterDevtools position='bottom-right' />
    </>
  )
}

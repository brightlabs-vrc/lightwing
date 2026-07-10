import { createFileRoute } from '@tanstack/react-router'
import { useAuth } from '../../../hooks/useAuth'
import { requireSiteAdmin } from '../../../lib/admin-guard'

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
    <div>
      <h1>Admin User Detail</h1>
      <p>Dynamic route param userId: {userId}</p>
      {isCurrentUser ? (
        <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: '1rem' }}>
          <p><strong>Name:</strong> {session?.user.name}</p>
          <p><strong>Email:</strong> {session?.user.email}</p>
          <p><strong>Site Role:</strong> {session?.user.siteRole ?? 'USER'}</p>
        </div>
      ) : (
        <p>This panel can only display details for the currently authenticated user right now.</p>
      )}
    </div>
  )
}

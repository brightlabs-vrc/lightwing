import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/admin/users/$userId')({
  component: AdminUserDetailPage,
})

function AdminUserDetailPage() {
  const { userId } = Route.useParams()

  return (
    <div>
      <h1>Admin User Detail</h1>
      <p>Dynamic route param userId: {userId}</p>
    </div>
  )
}

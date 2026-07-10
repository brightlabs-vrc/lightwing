import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/admin/')({
  component: AdminPage,
})

function AdminPage() {
  return (
    <div>
      <h1>Admin</h1>
      <p>This namespace is reserved for admin-facing functionality.</p>
    </div>
  )
}

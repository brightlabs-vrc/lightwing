import { createFileRoute } from '@tanstack/react-router'
import { requireAuth } from '../lib/auth-guard'

export const Route = createFileRoute('/dashboard')({
  beforeLoad: async ({ location }) => {
    await requireAuth(location)
  },
  component: DashboardPage,
})

function DashboardPage() {
  return (
    <div>
      <h1>Dashboard</h1>
      <p>Operational stats, race summaries, and moderation tools can live here.</p>
    </div>
  )
}

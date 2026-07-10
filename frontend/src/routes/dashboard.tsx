import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/dashboard')({
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

import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: HomePage,
})

function HomePage() {
  return (
    <div>
      <h1>Lightwing Frontend</h1>
      <p>
        This app uses TanStack Router file-based routes with Vite. Public and admin
        experiences share one app and are organized by route namespaces.
      </p>
    </div>
  )
}

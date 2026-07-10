import { createFileRoute, useNavigate } from '@tanstack/react-router'

const sampleUsers = [
  { id: 'u_001', role: 'owner' },
  { id: 'u_002', role: 'editor' },
  { id: 'u_003', role: 'viewer' },
]

export const Route = createFileRoute('/admin/users/')({
  component: AdminUsersPage,
})

function AdminUsersPage() {
  const navigate = useNavigate()

  return (
    <div>
      <h1>Admin Users</h1>
      <ul>
        {sampleUsers.map((user) => (
          <li key={user.id}>
            <button
              type='button'
              onClick={() =>
                navigate({
                  to: '/admin/users/$userId',
                  params: { userId: user.id },
                })
              }
              style={{
                background: 'none',
                border: 0,
                padding: 0,
                color: '#2563eb',
                textDecoration: 'underline',
                cursor: 'pointer',
                font: 'inherit',
              }}
            >
              {user.id} - {user.role}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

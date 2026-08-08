import { useAuth } from '../hooks/useAuth'
import { useMutation } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { requireAuth } from '../lib/auth-guard'
import { updateMyProfile } from '../lib/public-api'
import { Heading, Text, Button, TextInput, FormControl } from '@primer/react'

export const Route = createFileRoute('/onboarding')({
  beforeLoad: async ({ location }) => {
    await requireAuth(location)
  },
  component: OnboardingPage,
})

function OnboardingPage() {
  const { session } = useAuth()
  const [vrchatUsername, setVrchatUsername] = useState('')

  const updateMutation = useMutation({
    mutationFn: (username: string) =>
      updateMyProfile(
        session?.user.id ?? '',
        { vrchatUsername: username || null },
        `Bearer ${session?.session.token ?? ''}`,
      ),
    onSuccess: () => {
      window.location.href = '/events'
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    updateMutation.mutate(vrchatUsername.trim() || '')
  }

  return (
    <div style={{
      minHeight: '80vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem',
    }}>
      <div style={{
        maxWidth: '480px',
        width: '100%',
        backgroundColor: 'var(--color-canvas-default)',
        border: '1px solid var(--color-border-default)',
        borderRadius: '12px',
        padding: '2rem',
        boxShadow: 'var(--color-shadow-large)',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5rem',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', textAlign: 'center' }}>
          <Heading as="h1" style={{ fontSize: '28px', color: 'var(--color-accent-fg)' }}>
            Welcome to Lightwing!
          </Heading>
          <Text style={{ fontSize: '14px', color: '#57606a' }}>
            Please set your VRChat username to complete your profile.
          </Text>
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <FormControl required>
            <FormControl.Label style={{ fontWeight: 'bold' }}>VRChat Username</FormControl.Label>
            <TextInput
              placeholder="e.g. user123"
              value={vrchatUsername}
              onChange={(e) => setVrchatUsername(e.target.value)}
              autoFocus
              required
              width="100%"
            />
          </FormControl>

          <Button
            type="submit"
            variant="primary"
            disabled={updateMutation.isPending}
            style={{ width: '100%', padding: '12px' }}
          >
            {updateMutation.isPending ? 'Saving...' : 'Continue to Events'}
          </Button>
        </form>
      </div>
    </div>
  )
}

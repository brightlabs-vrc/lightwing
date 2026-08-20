'use client'

import { useState, useTransition } from 'react'
import { useMutation } from '@tanstack/react-query'
import { updateMyProfile } from '@/lib/public-api'
import { useNotification } from '@/hooks/useNotification'
import { Button, TextInput, FormControl } from '@primer/react'
import { useRouter } from 'next/navigation'
import { getSession } from '@/lib/auth'

interface OnboardingFormClientProps {
  userId: string
}

export function OnboardingFormClient({ userId }: OnboardingFormClientProps) {
  const [isPending, startTransition] = useTransition()
  const { addToast } = useNotification()
  const router = useRouter()

  const [vrchatUsername, setVrchatUsername] = useState('')

  const updateMutation = useMutation({
    mutationFn: async (username: string) => {
      const authSession = await getSession()
      const authHeader = authSession?.session.token ? `Bearer ${authSession.session.token}` : ''
      return updateMyProfile(userId, { vrchatUsername: username || null }, authHeader)
    },
    onSuccess: () => {
      router.push('/events')
    },
    onError: (err) => {
      addToast({ severity: 'error', message: err instanceof Error ? err.message : 'Failed to update profile' })
    },
  })

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        updateMutation.mutate(vrchatUsername.trim() || '')
      }}
      style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}
    >
      <FormControl required>
        <FormControl.Label style={{ fontWeight: 'bold' }}>VRChat Username</FormControl.Label>
        <TextInput
          placeholder="e.g. user123"
          value={vrchatUsername}
          onChange={(e) => setVrchatUsername(e.target.value)}
          autoFocus
          required
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
  )
}

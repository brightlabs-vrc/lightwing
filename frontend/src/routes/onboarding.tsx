import { useAuth } from '../hooks/useAuth'
import { useMutation } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { requireAuth } from '../lib/auth-guard'
import { updateMyProfile } from '../lib/public-api'
import {
  PixelContainer,
  PixelStack,
  PixelCard,
  PixelInput,
  PixelButton,
  PixelSectionHeader,
} from '@pxlkit/ui-kit'

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
      // Redirect to events after completing onboarding
      window.location.href = '/events'
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    updateMutation.mutate(vrchatUsername.trim() || '')
  }

  return (
    <PixelContainer maxWidth="md" padding="lg" className="min-h-screen flex items-center justify-center">
      <PixelCard className="w-full">
        <PixelStack gap={4}>
          <PixelSectionHeader
            title="WELCOME TO LIGHTWING!"
            titleTone="purple"
            size="md"
            description="Please set your VRChat username to complete your profile."
          />

          <form onSubmit={handleSubmit} className="space-y-4">
            <PixelInput
              label="VRCHAT USERNAME"
              placeholder="e.g. user123"
              value={vrchatUsername}
              onChange={(e) => setVrchatUsername(e.target.value)}
              autoFocus
              required
            />

            <PixelButton
              type="submit"
              variant="solid"
              tone="green"
              className="w-full"
              loading={updateMutation.isPending}
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? 'SAVING...' : 'CONTINUE TO EVENTS'}
            </PixelButton>
          </form>
        </PixelStack>
      </PixelCard>
    </PixelContainer>
  )
}

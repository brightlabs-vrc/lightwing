import { useAuth } from '../../hooks/useAuth'
import { useQuery, useMutation } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { requireAuth } from '../../lib/auth-guard'
import { getMyProfile, updateMyProfile } from '../../lib/public-api'
import {
  PixelContainer,
  PixelStack,
  PixelCard,
  PixelInput,
  PixelTextarea,
  PixelButton,
  PixelSectionHeader,
  PixelAlert,
  useToast,
} from '@pxlkit/ui-kit'

export const Route = createFileRoute('/profile/')({
  beforeLoad: async ({ location }) => {
    await requireAuth(location)
  },
  component: ProfilePage,
})

function ProfilePage() {
  const { session } = useAuth()
  const { toast } = useToast()
  const [biography, setBiography] = useState('')
  const [careerOverview, setCareerOverview] = useState('')
  const [vrchatUsername, setVrchatUsername] = useState('')

  const { data: profile, isLoading } = useQuery({
    queryKey: ['my-profile', session?.user.id],
    queryFn: () => getMyProfile(session?.user.id ?? ''),
    enabled: !!session,
  })

  // Initialize form values when profile loads
  useEffect(() => {
    if (profile) {
      setBiography(profile.biography ?? '')
      setCareerOverview(profile.careerOverview ?? '')
      setVrchatUsername(profile.vrchatUsername ?? '')
    }
  }, [profile])

  const updateMutation = useMutation({
    mutationFn: (data: { biography: string; careerOverview: string; vrchatUsername: string }) =>
      updateMyProfile(
        session?.user.id ?? '',
        {
          biography: data.biography || null,
          careerOverview: data.careerOverview || null,
          vrchatUsername: data.vrchatUsername || null,
        },
        `Bearer ${session?.session.token ?? ''}`,
      ),
    onSuccess: () => {
      toast({ tone: 'green', title: 'Profile updated successfully!' })
    },
  })

  if (isLoading) {
    return (
      <PixelContainer maxWidth="md" padding="md">
        <PixelAlert tone="neutral" message="LOADING PROFILE..." />
      </PixelContainer>
    )
  }

  return (
    <PixelContainer maxWidth="md" padding="md">
      <PixelSectionHeader title="EDIT PROFILE" titleTone="purple" size="lg" className="mb-6" />

      <PixelCard className="">
        <PixelStack gap={5}>
          <PixelInput label="NAME" value={profile?.name ?? ''} disabled />

          <PixelTextarea
            label="BIOGRAPHY"
            rows={3}
            value={biography}
            onChange={(e) => setBiography(e.target.value)}
            placeholder="Tell us about yourself..."
          />

          <PixelTextarea
            label="CAREER OVERVIEW"
            rows={3}
            value={careerOverview}
            onChange={(e) => setCareerOverview(e.target.value)}
            placeholder="Summarize your competitive career..."
          />

          <PixelInput
            label="VRCHAT USERNAME"
            placeholder="e.g. user123"
            value={vrchatUsername}
            onChange={(e) => setVrchatUsername(e.target.value)}
          />

          <PixelButton
            variant="solid"
            tone="purple"
            className="w-full"
            loading={updateMutation.isPending}
            disabled={updateMutation.isPending}
            onClick={() => updateMutation.mutate({ biography, careerOverview, vrchatUsername })}
          >
            {updateMutation.isPending ? 'SAVING...' : 'SAVE CHANGES'}
          </PixelButton>
        </PixelStack>
      </PixelCard>
    </PixelContainer>
  )
}

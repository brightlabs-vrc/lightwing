import { useAuth } from '../../hooks/useAuth'
import { useQuery, useMutation } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { requireAuth } from '../../lib/auth-guard'
import { getMyProfile, updateMyProfile } from '../../lib/public-api'
import { isValidUserSlug } from '../../lib/slugs'
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
  const [vrchatUsername, setVrchatUsername] = useState('')
  const [slug, setSlug] = useState('')

  const { data: profile, isLoading } = useQuery({
    queryKey: ['my-profile', session?.user.id],
    queryFn: () => getMyProfile(session?.user.id ?? ''),
    enabled: !!session,
  })

  // Initialize form values when profile loads
  useEffect(() => {
    if (profile) {
      setBiography(profile.biography ?? '')
      setVrchatUsername(profile.vrchatUsername ?? '')
      setSlug(profile.slug ?? '')
    }
  }, [profile])

  const updateMutation = useMutation({
    mutationFn: (data: { biography: string; vrchatUsername: string; slug: string }) =>
      updateMyProfile(
        session?.user.id ?? '',
        {
          biography: data.biography || null,
          vrchatUsername: data.vrchatUsername || null,
          slug: data.slug || undefined,
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
          {updateMutation.isError && (
            <PixelAlert tone="red" message={updateMutation.error instanceof Error ? updateMutation.error.message : 'Failed to update profile'} />
          )}

          <PixelInput label="NAME" value={profile?.name ?? ''} disabled />

          <PixelInput
            label="HANDLE"
            placeholder="e.g. competitorhandle"
            hint="Your unique Handle must be between 4 and 24 characters (lowercase letters, numbers, periods, dashes, and underscores)."
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
          />

          <PixelTextarea
            label="BIOGRAPHY"
            rows={3}
            value={biography}
            onChange={(e) => setBiography(e.target.value)}
            placeholder="Tell us about yourself..."
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
            onClick={() => {
              const trimmedSlug = slug.trim()
              if (trimmedSlug && (trimmedSlug.length < 4 || trimmedSlug.length > 24)) {
                toast({ tone: 'red', title: 'Slug must be between 4 and 24 characters.' })
                return
              }
              if (trimmedSlug && !isValidUserSlug(trimmedSlug)) {
                toast({ tone: 'red', title: 'Slug must contain only lowercase letters, numbers, periods, dashes, and underscores.' })
                return
              }
              updateMutation.mutate({ biography, vrchatUsername, slug: trimmedSlug })
            }}
          >
            {updateMutation.isPending ? 'SAVING...' : 'SAVE CHANGES'}
          </PixelButton>
        </PixelStack>
      </PixelCard>
    </PixelContainer>
  )
}

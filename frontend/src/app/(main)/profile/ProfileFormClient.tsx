'use client'

import { useState, useTransition } from 'react'
import { useMutation } from '@tanstack/react-query'
import { updateMyProfile } from '@/lib/public-api'
import { useNotification } from '@/hooks/useNotification'
import { Button, TextInput, FormControl, Textarea, Spinner } from '@primer/react'
import type { auth } from '@/lib/client'
import { getSession } from '@/lib/auth'

interface ProfileFormClientProps {
  initialProfile: auth.UserProfile
  userId: string
}

export function ProfileFormClient({ initialProfile, userId }: ProfileFormClientProps) {
  const [isPending, startTransition] = useTransition()
  const { addToast } = useNotification()

  const [biography, setBiography] = useState(initialProfile.biography ?? '')
  const [careerOverview, setCareerOverview] = useState(initialProfile.careerOverview ?? '')
  const [vrchatUsername, setVrchatUsername] = useState(initialProfile.vrchatUsername ?? '')
  const [slug, setSlug] = useState(initialProfile.slug ?? '')

  const mutation = useMutation({
    mutationFn: async () => {
      const authSession = await getSession()
      const authHeader = authSession?.session.token ? `Bearer ${authSession.session.token}` : ''
      return updateMyProfile(userId, {
        biography: biography.trim(),
        careerOverview: careerOverview.trim(),
        vrchatUsername: vrchatUsername.trim(),
        slug: slug.trim(),
      }, authHeader)
    },
    onSuccess: () => {
      addToast({ message: 'Profile updated', severity: 'success' })
    },
    onError: (error) => {
      addToast({ message: error instanceof Error ? error.message : 'Failed to update profile', severity: 'error' })
    },
  })

  const isEditing = biography !== initialProfile.biography ||
    careerOverview !== initialProfile.careerOverview ||
    vrchatUsername !== initialProfile.vrchatUsername ||
    slug !== initialProfile.slug

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <FormControl>
        <FormControl.Label>Biography</FormControl.Label>
        <Textarea
          value={biography}
          onChange={(e) => setBiography(e.target.value)}
          placeholder="Tell us about yourself..."
          rows={3}
        />
      </FormControl>

      <FormControl>
        <FormControl.Label>Career Overview</FormControl.Label>
        <Textarea
          value={careerOverview}
          onChange={(e) => setCareerOverview(e.target.value)}
          placeholder="Your racing career highlights..."
          rows={3}
        />
      </FormControl>

      <FormControl>
        <FormControl.Label>VRChat Username</FormControl.Label>
        <TextInput
          value={vrchatUsername}
          onChange={(e) => setVrchatUsername(e.target.value)}
          placeholder="Your VRChat username"
        />
      </FormControl>

      <FormControl>
        <FormControl.Label>Handle (@)</FormControl.Label>
        <TextInput
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          placeholder="Your Lightwing handle"
        />
      </FormControl>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
        <Button
          variant="primary"
          onClick={() => startTransition(() => mutation.mutate())}
          disabled={mutation.isPending || !isEditing}
        >
          {mutation.isPending ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </div>
  )
}

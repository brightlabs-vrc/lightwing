import { useAuth } from '../../hooks/useAuth'
import { useQuery, useMutation } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { requireAuth } from '../../lib/auth-guard'
import { getMyProfile, updateMyProfile } from '../../lib/public-api'
import { useNotification } from '../../hooks/useNotification'
import { Heading, Text, Button, TextInput, FormControl, Textarea, Spinner } from '@primer/react'

export const Route = createFileRoute('/profile/')({
  beforeLoad: async ({ location }) => {
    await requireAuth(location)
  },
  component: ProfilePage,
})

function ProfilePage() {
  const { session } = useAuth()
  const { addToast } = useNotification()
  const [biography, setBiography] = useState('')
  const [careerOverview, setCareerOverview] = useState('')
  const [vrchatUsername, setVrchatUsername] = useState('')
  const [slug, setSlug] = useState('')

  const { data: profile, isLoading } = useQuery({
    queryKey: ['my-profile', session?.user.id],
    queryFn: () => getMyProfile(session?.user.id ?? ''),
    enabled: !!session,
  })

  useEffect(() => {
    if (profile) {
      setBiography(profile.biography ?? '')
      setCareerOverview(profile.careerOverview ?? '')
      setVrchatUsername(profile.vrchatUsername ?? '')
      setSlug(profile.slug ?? '')
    }
  }, [profile])

  const updateMutation = useMutation({
    mutationFn: (data: { biography: string; careerOverview: string; vrchatUsername: string; slug: string }) =>
      updateMyProfile(
        session?.user.id ?? '',
        {
          biography: data.biography || null,
          careerOverview: data.careerOverview || null,
          vrchatUsername: data.vrchatUsername || null,
          slug: data.slug || undefined,
        },
        `Bearer ${session?.session.token ?? ''}`,
      ),
    onSuccess: () => {
      addToast({ severity: 'success', message: 'Profile updated successfully!' })
    },
    onError: (err) => {
      addToast({ severity: 'error', message: err instanceof Error ? err.message : 'Failed to update profile' })
    }
  })

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem', gap: '0.5rem', color: '#57606a' }}>
        <Spinner size="medium" />
        <span>Loading Profile...</span>
      </div>
    )
  }

  const handleSave = () => {
    const trimmedSlug = slug.trim()
    if (trimmedSlug && (trimmedSlug.length < 4 || trimmedSlug.length > 24)) {
      addToast({ severity: 'error', message: 'Slug must be between 4 and 24 characters.' })
      return
    }
    if (trimmedSlug && !/^[a-z0-9]+$/.test(trimmedSlug)) {
      addToast({ severity: 'error', message: 'Slug must contain only lowercase letters and numbers.' })
      return
    }
    updateMutation.mutate({ biography, careerOverview, vrchatUsername, slug: trimmedSlug })
  }

  return (
    <div style={{ maxWidth: '640px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <Heading as="h1" style={{ fontSize: '28px', color: 'var(--color-accent-fg)', margin: 0 }}>
        Edit Profile
      </Heading>

      <div style={{
        backgroundColor: 'var(--color-canvas-default)',
        border: '1px solid var(--color-border-default)',
        borderRadius: '8px',
        padding: '2rem',
        boxShadow: 'var(--color-shadow-small)',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5rem'
      }}>
        {updateMutation.isError && (
          <div style={{
            backgroundColor: 'var(--color-danger-subtle)',
            border: '1px solid var(--color-danger-border)',
            borderRadius: '6px',
            padding: '1rem',
            color: 'var(--color-danger-fg)',
            fontSize: '14px'
          }}>
            {updateMutation.error instanceof Error ? updateMutation.error.message : 'Failed to update profile'}
          </div>
        )}

        <FormControl disabled>
          <FormControl.Label style={{ fontWeight: 'bold' }}>Name</FormControl.Label>
          <TextInput value={profile?.name ?? ''} disabled width="100%" />
        </FormControl>

        <FormControl>
          <FormControl.Label style={{ fontWeight: 'bold' }}>Handle</FormControl.Label>
          <TextInput
            placeholder="e.g. competitorhandle"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            width="100%"
          />
          <FormControl.Caption>
            Your unique Handle must be between 4 and 24 characters (lowercase letters and numbers only).
          </FormControl.Caption>
        </FormControl>

        <FormControl>
          <FormControl.Label style={{ fontWeight: 'bold' }}>Biography</FormControl.Label>
          <Textarea
            rows={4}
            value={biography}
            onChange={(e) => setBiography(e.target.value)}
            placeholder="Tell us about yourself..."
            style={{ width: '100%' }}
          />
        </FormControl>

        <FormControl>
          <FormControl.Label style={{ fontWeight: 'bold' }}>Career Overview</FormControl.Label>
          <Textarea
            rows={4}
            value={careerOverview}
            onChange={(e) => setCareerOverview(e.target.value)}
            placeholder="Summarize your competitive career..."
            style={{ width: '100%' }}
          />
        </FormControl>

        <FormControl>
          <FormControl.Label style={{ fontWeight: 'bold' }}>VRChat Username</FormControl.Label>
          <TextInput
            placeholder="e.g. user123"
            value={vrchatUsername}
            onChange={(e) => setVrchatUsername(e.target.value)}
            width="100%"
          />
        </FormControl>

        <Button
          variant="primary"
          onClick={handleSave}
          disabled={updateMutation.isPending}
          style={{ width: '100%', padding: '12px' }}
        >
          {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </div>
  )
}

import { useAuth } from '../../hooks/useAuth'
import { usePageHead } from '../../hooks/usePageHead'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { requireAuth } from '../../lib/auth-guard'
import { getMyProfile, updateMyProfile } from '../../lib/public-api'
import { isValidUserSlug } from '../../lib/slugs'
import {
  PixelContainer,
  PixelStack,
  PixelCard,
  PixelInput,
  PixelButton,
  PixelSectionHeader,
  PixelAlert,
  PixelBadge,
  useToast,
} from '@pxlkit/ui-kit'
import { MarkdownEditor } from '../../components/MarkdownEditor'
import { PixelSkeletonForm } from '../../components/LoadingSkeleton'

export const Route = createFileRoute('/profile/')({
  beforeLoad: async ({ location }) => {
    await requireAuth(location)
  },
  pendingComponent: () => (
    <PixelContainer maxWidth="full" padding="none">
      <PixelSkeletonForm />
    </PixelContainer>
  ),
  component: ProfilePage,
})

function ProfilePage() {
  usePageHead({
    title: 'Edit Profile',
    description: 'Manage your UmaKeiba participant profile details.',
  })

  const { session } = useAuth()
  const { toast } = useToast()
  const queryClient = useQueryClient()
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
    onSuccess: (updated) => {
      queryClient.setQueryData(['my-profile', session?.user.id], updated)
      toast({ tone: 'green', title: 'Profile updated successfully!' })
    },
  })

  if (isLoading) {
    return (
      <PixelContainer maxWidth="full" padding="none">
        <PixelSkeletonForm />
      </PixelContainer>
    )
  }

  const trimmedSlug = slug.trim()
  const previewDisplayName = vrchatUsername.trim() || profile?.name || session?.user.name || 'Participant'
  const publicSlug = profile?.slug || session?.user.id || ''

  const handleSave = () => {
    if (trimmedSlug && (trimmedSlug.length < 4 || trimmedSlug.length > 24)) {
      toast({ tone: 'red', title: '@username must be between 4 and 24 characters.' })
      return
    }
    if (trimmedSlug && !isValidUserSlug(trimmedSlug)) {
      toast({ tone: 'red', title: '@username must contain only lowercase letters, numbers, periods, dashes, and underscores.' })
      return
    }
    updateMutation.mutate({ biography, vrchatUsername: vrchatUsername.trim(), slug: trimmedSlug })
  }

  const handleReset = () => {
    if (!profile) return
    setBiography(profile.biography ?? '')
    setVrchatUsername(profile.vrchatUsername ?? '')
    setSlug(profile.slug ?? '')
  }

  return (
    <PixelContainer maxWidth="full" padding="none" className="max-w-6xl mx-auto">
      <PixelStack gap={6}>
        {/* Header Bar */}
        <PixelCard className="bg-retro-surface border-2 border-retro-border-strong">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <PixelSectionHeader title="PROFILE SETTINGS" titleTone="purple" size="lg" />
              <p className="font-sans text-xs sm:text-sm text-retro-muted mt-1">
                Customize your public @username, VRChat display name, and Markdown biography.
              </p>
            </div>
            {publicSlug && (
              <PixelButton asChild variant="outline" tone="cyan" size="sm" className="w-full sm:w-auto justify-center shrink-0">
                <Link to="/$user" params={{ user: publicSlug }}>
                  VIEW PUBLIC PROFILE →
                </Link>
              </PixelButton>
            )}
          </div>
        </PixelCard>

        {updateMutation.isError && (
          <PixelAlert
            tone="red"
            message={updateMutation.error instanceof Error ? updateMutation.error.message : 'Failed to update profile'}
          />
        )}

        {/* Identity & Live Profile Card Preview */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          <PixelCard className="lg:col-span-2 bg-retro-surface border-2 border-retro-border-strong">
            <PixelStack gap={5}>
              <PixelSectionHeader title="IDENTITY & ACCOUNT DETAILS" titleTone="cyan" size="sm" />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <PixelInput
                  label="DISCORD ACCOUNT NAME"
                  value={profile?.name ?? ''}
                  hint="Synced from your Discord account."
                  disabled
                />

                <PixelInput
                  label="VRCHAT USERNAME (DISPLAY NAME)"
                  placeholder="e.g. Minori"
                  hint="Shown as your primary display name on leaderboards and profiles."
                  value={vrchatUsername}
                  onChange={(e) => setVrchatUsername(e.target.value)}
                />
              </div>

              <PixelInput
                label="@USERNAME (CUSTOM PROFILE URL)"
                placeholder="e.g. participantname"
                hint="4–24 characters using lowercase letters, numbers, periods, dashes, and underscores."
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
              />
            </PixelStack>
          </PixelCard>

          {/* Live Profile Card Preview */}
          <PixelCard className="bg-retro-surface border-2 border-retro-border-strong">
            <PixelStack gap={4}>
              <PixelSectionHeader title="LIVE PROFILE PREVIEW" titleTone="gold" size="sm" />

              <div className="p-4 rounded bg-retro-bg border-2 border-retro-border space-y-3">
                <div className="flex items-center gap-3.5 min-w-0">
                  <img
                    src={profile?.image || session?.user.image || '/fallback_avatar.jpg'}
                    alt={previewDisplayName}
                    onError={(e) => {
                      e.currentTarget.src = '/fallback_avatar.jpg'
                    }}
                    className="w-14 h-14 rounded-full border-2 border-retro-border bg-retro-surface object-cover shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="font-pixel text-sm font-bold text-retro-text truncate">
                      {previewDisplayName}
                    </div>
                    <div className="font-sans text-xs text-retro-muted font-semibold truncate">
                      @{trimmedSlug || 'username'}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-retro-border">
                  {profile?.classTier && profile.classTier !== 'PRE_OP' && profile.classTier !== 'OP' ? (
                    <PixelBadge tone="purple">{profile.classTier}</PixelBadge>
                  ) : (
                    <PixelBadge tone="cyan">OPEN CLASS</PixelBadge>
                  )}
                  {profile?.siteRole === 'SITE_ADMIN' && (
                    <PixelBadge tone="pink">SITE ADMIN</PixelBadge>
                  )}
                </div>

                <div className="font-mono text-[11px] text-retro-muted truncate">
                  umakeiba.com/@{trimmedSlug || 'username'}
                </div>
              </div>
            </PixelStack>
          </PixelCard>
        </div>

        {/* Full-Width Biography & Live Preview */}
        <PixelCard className="bg-retro-surface border-2 border-retro-border-strong">
          <PixelStack gap={4}>
            <PixelSectionHeader
              title="BIOGRAPHY & LIVE MARKDOWN PREVIEW"
              titleTone="purple"
              size="sm"
            />
            <MarkdownEditor
              value={biography}
              onChange={setBiography}
              minHeight="280px"
              defaultMode="split"
              placeholder="Tell us about yourself using Markdown (links, headings, lists, formatting)..."
              previewFallbackText="No biography details provided yet."
            />

            <div className="flex flex-wrap items-center justify-end gap-3 pt-4 border-t border-retro-border">
              <PixelButton
                type="button"
                variant="ghost"
                tone="neutral"
                size="md"
                disabled={updateMutation.isPending}
                onClick={handleReset}
              >
                RESET CHANGES
              </PixelButton>
              <PixelButton
                type="button"
                variant="solid"
                tone="purple"
                size="md"
                loading={updateMutation.isPending}
                disabled={updateMutation.isPending}
                onClick={handleSave}
              >
                {updateMutation.isPending ? 'SAVING...' : 'SAVE PROFILE CHANGES'}
              </PixelButton>
            </div>
          </PixelStack>
        </PixelCard>
      </PixelStack>
    </PixelContainer>
  )
}

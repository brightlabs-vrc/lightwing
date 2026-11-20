import React, { useEffect, useState } from 'react'
import { createFileRoute, Link, useParams } from '@tanstack/react-router'
import {
  PixelContainer,
  PixelEmptyState,
  PixelButton,
} from '@pxlkit/ui-kit'
import { getPublicUserProfile } from '../../lib/public-api'
import type { auth } from '../../lib/client'
import { buildSeoMeta } from '../../lib/seo'
import { UserProfileView } from '../../components/UserProfileView'
import { PixelSkeletonProfile } from '../../components/LoadingSkeleton'

export const Route = createFileRoute('/u/$user')({
  ssr: 'data-only',
  loader: async ({ params }) => {
    try {
      const userProfile = await getPublicUserProfile(params.user)
      return { userProfile }
    } catch {
      return { userProfile: null }
    }
  },
  head: ({ loaderData, params }) => {
    const user = loaderData?.userProfile
    if (user) {
      const displayName = user.vrchatUsername || user.name
      return {
        meta: buildSeoMeta({
          title: displayName,
          description:
            user.biography || `User profile for ${displayName} on UmaKeiba.`,
          image: user.image || undefined,
          type: 'profile',
        }),
      }
    }
    return {
      meta: buildSeoMeta({
        title: `@${params.user}`,
        description: `No user profile found for "@${params.user}".`,
      }),
    }
  },
  pendingComponent: () => (
    <PixelContainer maxWidth="full" padding="none" className="max-w-6xl mx-auto">
      <PixelSkeletonProfile />
    </PixelContainer>
  ),
  component: UserProfilePage,
})

export function UserProfilePage() {
  const { user: userOrSlug } = useParams({ from: '/u/$user' })
  const loaderData = Route.useLoaderData()

  const [loading, setLoading] = useState(!loaderData?.userProfile)
  const [userProfile, setUserProfile] = useState<auth.UserProfile | null>(
    loaderData?.userProfile ?? null
  )
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (
      loaderData?.userProfile &&
      (loaderData.userProfile.slug === userOrSlug ||
        loaderData.userProfile.id === userOrSlug)
    ) {
      setUserProfile(loaderData.userProfile)
      setError(null)
      setLoading(false)
      return
    }

    let active = true

    async function loadUser() {
      if (!userOrSlug) return
      setLoading(true)
      setError(null)
      try {
        const u = await getPublicUserProfile(userOrSlug)
        if (active) {
          setUserProfile(u)
        }
      } catch {
        if (active) {
          setError(`No user profile found for "@${userOrSlug}".`)
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    void loadUser()
    return () => {
      active = false
    }
  }, [userOrSlug, loaderData])

  if (loading) {
    return (
      <PixelContainer maxWidth="full" padding="none" className="max-w-6xl mx-auto">
        <PixelSkeletonProfile />
      </PixelContainer>
    )
  }

  if (userProfile) {
    return <UserProfileView user={userProfile} />
  }

  return (
    <PixelContainer maxWidth="md" padding="md">
      <PixelEmptyState
        title="User Not Found"
        description={error || 'The requested user profile does not exist.'}
        action={
          <PixelButton asChild variant="solid" tone="purple" size="sm">
            <Link to="/leaderboard">GO TO LEADERBOARD</Link>
          </PixelButton>
        }
      />
    </PixelContainer>
  )
}

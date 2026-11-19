import React, { useEffect, useState } from 'react'
import { createFileRoute, Link, useParams } from '@tanstack/react-router'
import {
  PixelContainer,
  PixelSpinner,
  PixelEmptyState,
  PixelButton,
} from '@pxlkit/ui-kit'
import { getPublicUserProfile, getPublicTeamProfile } from '../lib/public-api'
import type { auth, teammanager } from '../lib/client'
import { buildSeoMeta } from '../lib/seo'
import { UserProfileView } from '../components/UserProfileView'
import { TeamProfileView } from '../components/TeamProfileView'

export const Route = createFileRoute('/$user')({
  ssr: 'data-only',
  loader: async ({ params }) => {
    try {
      const u = await getPublicUserProfile(params.user)
      if (u) {
        return { userProfile: u, teamProfile: null }
      }
    } catch {
      // User not found, try team profile
    }

    try {
      const t = await getPublicTeamProfile(params.user)
      if (t) {
        return { userProfile: null, teamProfile: t }
      }
    } catch {
      // Neither user nor team found
    }

    return { userProfile: null, teamProfile: null }
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

    const team = loaderData?.teamProfile
    if (team) {
      const isOrg =
        team.isOrganization ??
        (!team.primaryOrganizationId || team.primaryOrganizationId === team.id)
      return {
        meta: buildSeoMeta({
          title: team.name,
          description:
            team.description ||
            `${isOrg ? 'Organization' : 'Team'} profile for ${team.name} on UmaKeiba.`,
          image: team.logo || undefined,
          type: 'website',
        }),
      }
    }

    return {
      meta: buildSeoMeta({
        title: `@${params.user}`,
        description: `No user or team profile found for "@${params.user}".`,
      }),
    }
  },
  component: DynamicProfilePage,
})

export function DynamicProfilePage() {
  const { user: userOrSlug } = useParams({ from: '/$user' })
  const loaderData = Route.useLoaderData()

  const hasInitialData = Boolean(
    loaderData?.userProfile || loaderData?.teamProfile
  )
  const [loading, setLoading] = useState(!hasInitialData)
  const [userProfile, setUserProfile] = useState<auth.UserProfile | null>(
    loaderData?.userProfile ?? null
  )
  const [teamProfile, setTeamProfile] = useState<teammanager.Team | null>(
    loaderData?.teamProfile ?? null
  )
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (
      loaderData?.userProfile &&
      (loaderData.userProfile.slug === userOrSlug ||
        loaderData.userProfile.id === userOrSlug)
    ) {
      setUserProfile(loaderData.userProfile)
      setTeamProfile(null)
      setError(null)
      setLoading(false)
      return
    }
    if (
      loaderData?.teamProfile &&
      (loaderData.teamProfile.slug === userOrSlug ||
        loaderData.teamProfile.id === userOrSlug)
    ) {
      setTeamProfile(loaderData.teamProfile)
      setUserProfile(null)
      setError(null)
      setLoading(false)
      return
    }

    let active = true

    async function resolveProfile() {
      if (!userOrSlug) return
      setLoading(true)
      setError(null)
      setUserProfile(null)
      setTeamProfile(null)

      // Try user profile lookup first
      try {
        const u = await getPublicUserProfile(userOrSlug)
        if (active && u) {
          setUserProfile(u)
          setLoading(false)
          return
        }
      } catch {
        // User not found, try team profile
      }

      // Try team profile lookup
      try {
        const t = await getPublicTeamProfile(userOrSlug)
        if (active && t) {
          setTeamProfile(t)
          setLoading(false)
          return
        }
      } catch {
        // Neither user nor team found
      }

      if (active) {
        setError(`No user or team profile found for "@${userOrSlug}".`)
        setLoading(false)
      }
    }

    void resolveProfile()
    return () => {
      active = false
    }
  }, [userOrSlug, loaderData])

  if (loading) {
    return (
      <PixelContainer maxWidth="full" padding="md">
        <div className="flex justify-center items-center py-16">
          <PixelSpinner size="lg" />
        </div>
      </PixelContainer>
    )
  }

  if (userProfile) {
    return <UserProfileView user={userProfile} />
  }

  if (teamProfile) {
    return <TeamProfileView team={teamProfile} />
  }

  return (
    <PixelContainer maxWidth="md" padding="md">
      <PixelEmptyState
        title="Profile Not Found"
        description={error || "The requested user or team profile does not exist."}
        action={
          <PixelButton asChild variant="solid" tone="purple" size="sm">
            <Link to="/leaderboard">GO TO LEADERBOARD</Link>
          </PixelButton>
        }
      />
    </PixelContainer>
  )
}

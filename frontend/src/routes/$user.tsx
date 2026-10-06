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
import { UserProfileView } from '../components/UserProfileView'
import { TeamProfileView } from '../components/TeamProfileView'

export const Route = createFileRoute('/$user')({
  component: DynamicProfilePage,
})

export function DynamicProfilePage() {
  const { user: userOrSlug } = useParams({ from: '/$user' })

  const [loading, setLoading] = useState(true)
  const [userProfile, setUserProfile] = useState<auth.UserProfile | null>(null)
  const [teamProfile, setTeamProfile] = useState<teammanager.Team | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
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
  }, [userOrSlug])

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

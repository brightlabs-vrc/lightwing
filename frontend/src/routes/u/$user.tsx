import React, { useEffect, useState } from 'react'
import { createFileRoute, Link, useParams } from '@tanstack/react-router'
import {
  PixelContainer,
  PixelSpinner,
  PixelEmptyState,
  PixelButton,
} from '@pxlkit/ui-kit'
import { getPublicUserProfile } from '../../lib/public-api'
import type { auth } from '../../lib/client'
import { UserProfileView } from '../../components/UserProfileView'

export const Route = createFileRoute('/u/$user')({
  component: UserProfilePage,
})

export function UserProfilePage() {
  const { user: userOrSlug } = useParams({ from: '/u/$user' })

  const [loading, setLoading] = useState(true)
  const [userProfile, setUserProfile] = useState<auth.UserProfile | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
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

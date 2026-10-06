import React, { useEffect, useState } from 'react'
import { createFileRoute, Link, useParams } from '@tanstack/react-router'
import {
  PixelContainer,
  PixelSpinner,
  PixelEmptyState,
  PixelButton,
} from '@pxlkit/ui-kit'
import { getPublicTeamProfile } from '../../lib/public-api'
import type { teammanager } from '../../lib/client'
import { TeamProfileView } from '../../components/TeamProfileView'

export const Route = createFileRoute('/t/$team')({
  component: TeamProfilePage,
})

export function TeamProfilePage() {
  const { team: teamOrSlug } = useParams({ from: '/t/$team' })

  const [loading, setLoading] = useState(true)
  const [teamProfile, setTeamProfile] = useState<teammanager.Team | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    async function loadTeam() {
      if (!teamOrSlug) return
      setLoading(true)
      setError(null)
      try {
        const t = await getPublicTeamProfile(teamOrSlug)
        if (active) {
          setTeamProfile(t)
        }
      } catch {
        if (active) {
          setError(`No team profile found for "@${teamOrSlug}".`)
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    void loadTeam()
    return () => {
      active = false
    }
  }, [teamOrSlug])

  if (loading) {
    return (
      <PixelContainer maxWidth="full" padding="md">
        <div className="flex justify-center items-center py-16">
          <PixelSpinner size="lg" />
        </div>
      </PixelContainer>
    )
  }

  if (teamProfile) {
    return <TeamProfileView team={teamProfile} />
  }

  return (
    <PixelContainer maxWidth="md" padding="md">
      <PixelEmptyState
        title="Team Not Found"
        description={error || 'The requested team profile does not exist.'}
        action={
          <PixelButton asChild variant="solid" tone="purple" size="sm">
            <Link to="/leaderboard">GO TO LEADERBOARD</Link>
          </PixelButton>
        }
      />
    </PixelContainer>
  )
}

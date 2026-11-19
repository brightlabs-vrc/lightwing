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
import { buildSeoMeta } from '../../lib/seo'
import { TeamProfileView } from '../../components/TeamProfileView'

export const Route = createFileRoute('/t/$team')({
  ssr: 'data-only',
  loader: async ({ params }) => {
    try {
      const teamProfile = await getPublicTeamProfile(params.team)
      return { teamProfile }
    } catch {
      return { teamProfile: null }
    }
  },
  head: ({ loaderData, params }) => {
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
        title: `@${params.team}`,
        description: `No team profile found for "@${params.team}".`,
      }),
    }
  },
  component: TeamProfilePage,
})

export function TeamProfilePage() {
  const { team: teamOrSlug } = useParams({ from: '/t/$team' })
  const loaderData = Route.useLoaderData()

  const [loading, setLoading] = useState(!loaderData?.teamProfile)
  const [teamProfile, setTeamProfile] = useState<teammanager.Team | null>(
    loaderData?.teamProfile ?? null
  )
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (
      loaderData?.teamProfile &&
      (loaderData.teamProfile.slug === teamOrSlug ||
        loaderData.teamProfile.id === teamOrSlug)
    ) {
      setTeamProfile(loaderData.teamProfile)
      setError(null)
      setLoading(false)
      return
    }

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
  }, [teamOrSlug, loaderData])

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

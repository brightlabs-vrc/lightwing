// @vitest-environment jsdom
import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { TeamProfileView } from './TeamProfileView'
import type { teammanager } from '../lib/client'

// Mock tanstack react-router Link to simple anchor/span
vi.mock('@tanstack/react-router', () => ({
  Link: React.forwardRef(({ children, to, params, ...props }: any, ref: any) => (
    <a ref={ref} href={to} {...props}>
      {children}
    </a>
  )),
}))

// Mock useAuth
vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    session: {
      user: {
        id: 'user_1',
        siteRole: 'SITE_ADMIN',
      },
    },
  }),
}))

describe('TeamProfileView', () => {
  const mockOrg: teammanager.Team = {
    id: 'org_1',
    name: 'Twilight Festival',
    slug: 'twfs',
    logo: '',
    description: 'An official governing organization.',
    status: 'APPROVED',
    primaryOrganizationId: 'org_1',
    isOrganization: true,
    organizations: [],
    teams: [
      {
        id: 'team_spica',
        name: 'Team Spica',
        slug: 'team-spica',
        logo: '',
        description: '',
        status: 'APPROVED',
        isPrimary: true,
        memberCount: 7,
      },
    ],
    stats: {
      rankingAverage: 0,
      pointsAverage: 0,
      seasonRank: 0,
      averagePointsPerEvent: 0,
      teamEventsParticipated: 0,
      teamTotalPoints: 0,
      teamAveragePoints: 0,
      teamEventRankAverage: 0,
      seasonRankSource: 'MEMBER_AVERAGE',
      year: 0,
      availableYears: [],
    },
    administratorSlotsRemaining: 3,
    members: [
      {
        userId: 'u1',
        name: 'Bluebrealk',
        slug: 'cappunico',
        image: '',
        role: 'member',
      },
      {
        userId: 'u2',
        name: 'Sir Brycius',
        slug: 'brycius',
        image: '',
        role: 'administrator',
      },
    ],
  }

  const mockIndependentTeam: teammanager.Team = {
    id: 'team_2',
    name: 'Apex Racing Syndicate',
    slug: 'apex',
    logo: '',
    description: 'An independent competitive racing team.',
    status: 'APPROVED',
    primaryOrganizationId: '',
    isOrganization: false,
    organizations: [
      {
        id: 'org_1',
        name: 'Twilight Festival',
        slug: 'twfs',
        logo: '',
        description: '',
        orgType: 'ORGANIZATION',
        status: 'APPROVED',
        isPrimary: true,
        memberCount: 2,
      },
    ],
    teams: [],
    stats: {
      rankingAverage: 1.5,
      pointsAverage: 45.0,
      seasonRank: 1,
      averagePointsPerEvent: 15.0,
      teamEventsParticipated: 0,
      teamTotalPoints: 0,
      teamAveragePoints: 0,
      teamEventRankAverage: 0,
      seasonRankSource: 'MEMBER_AVERAGE',
      year: 0,
      availableYears: [],
    },
    administratorSlotsRemaining: 2,
    members: [
      {
        userId: 'u3',
        name: 'SpeedRacer',
        slug: 'speedy',
        image: '',
        role: 'administrator',
      },
      {
        userId: 'u4',
        name: 'TrackRunner',
        slug: 'runner',
        image: '',
        role: 'member',
      },
    ],
  }

  it('renders organization details with ORGANIZATION badge, tight avatar cluster, separated STAFF and MEMBERS directories, and AFFILIATED TEAMS without team stats', () => {
    const { unmount } = render(<TeamProfileView team={mockOrg} />)

    expect(screen.getByText('Twilight Festival')).not.toBeNull()
    expect(screen.getByText('ORGANIZATION')).not.toBeNull()
    expect(screen.getByText('MANAGE ORG')).not.toBeNull()
    expect(screen.getByText('STAFF')).not.toBeNull()
    expect(screen.getByText('AFFILIATED TEAMS (1)')).not.toBeNull()
    expect(screen.getByText('Team Spica')).not.toBeNull()
    expect(screen.queryByText('TEAM STATISTICS')).toBeNull()

    const staffDir = screen.getByTestId('staff-directory')
    expect(staffDir.textContent).toContain('Sir Brycius')
    expect(staffDir.textContent).not.toContain('Bluebrealk')

    const membersDir = screen.getByTestId('members-directory')
    expect(membersDir.textContent).toContain('Bluebrealk')
    expect(membersDir.textContent).not.toContain('Sir Brycius')

    const avatarCluster = screen.getByTestId('members-avatar-cluster')
    expect(avatarCluster.className).toContain('flex-wrap')
    expect(avatarCluster.className).toContain('gap-1.5')
    unmount()
  })

  it('renders competitive team details with TEAM badge, separated STAFF and MEMBERS directories, AFFILIATED ORGANIZATIONS, and calculated TEAM STATISTICS', () => {
    const { unmount } = render(<TeamProfileView team={mockIndependentTeam} />)

    expect(screen.getByText('Apex Racing Syndicate')).not.toBeNull()
    expect(screen.getByText('TEAM')).not.toBeNull()
    expect(screen.getByText('MANAGE TEAM')).not.toBeNull()
    expect(screen.getByText('STAFF')).not.toBeNull()
    expect(screen.getByText('TEAM STATISTICS')).not.toBeNull()
    expect(screen.getByText('AFFILIATED ORGANIZATIONS (1)')).not.toBeNull()
    expect(screen.getByText('#1')).not.toBeNull()
    expect(screen.getByText('1.5')).not.toBeNull()
    expect(screen.getByText('15.0')).not.toBeNull()
    expect(screen.getByText('45.0')).not.toBeNull()

    const staffDir = screen.getByTestId('staff-directory')
    expect(staffDir.textContent).toContain('SpeedRacer')
    expect(staffDir.textContent).not.toContain('TrackRunner')

    const membersDir = screen.getByTestId('members-directory')
    expect(membersDir.textContent).toContain('TrackRunner')
    expect(membersDir.textContent).not.toContain('SpeedRacer')
    unmount()
  })
})

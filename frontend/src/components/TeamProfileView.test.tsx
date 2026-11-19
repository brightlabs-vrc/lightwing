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
    stats: {
      rankingAverage: 0,
      pointsAverage: 0,
      seasonRank: 0,
      averagePointsPerEvent: 0,
    },
    administratorSlotsRemaining: 3,
    members: [
      {
        userId: 'u1',
        name: 'Bluebrealk',
        slug: 'cappunico',
        role: 'member',
      },
      {
        userId: 'u2',
        name: 'Sir Brycius',
        slug: 'brycius',
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
    organizations: [],
    stats: {
      rankingAverage: 1.5,
      pointsAverage: 45.0,
      seasonRank: 1,
      averagePointsPerEvent: 15.0,
    },
    administratorSlotsRemaining: 3,
    members: [
      {
        userId: 'u3',
        name: 'SpeedRacer',
        slug: 'speedy',
        role: 'administrator',
      },
    ],
  }

  it('renders organization details with ORGANIZATION badge and STAFF header without team stats', () => {
    render(<TeamProfileView team={mockOrg} />)

    expect(screen.getByText('Twilight Festival')).not.toBeNull()
    expect(screen.getByText('ORGANIZATION')).not.toBeNull()
    expect(screen.getByText('MANAGE ORG')).not.toBeNull()
    expect(screen.getByText('STAFF')).not.toBeNull()
    expect(screen.queryByText('TEAM STATISTICS')).toBeNull()
  })

  it('renders competitive team details with TEAM badge, STAFF & MEMBERS header, and TEAM STATISTICS', () => {
    render(<TeamProfileView team={mockIndependentTeam} />)

    expect(screen.getByText('Apex Racing Syndicate')).not.toBeNull()
    expect(screen.getByText('TEAM')).not.toBeNull()
    expect(screen.getByText('MANAGE TEAM')).not.toBeNull()
    expect(screen.getByText('STAFF & MEMBERS')).not.toBeNull()
    expect(screen.getByText('TEAM STATISTICS')).not.toBeNull()
    expect(screen.getByText('#1')).not.toBeNull()
    expect(screen.getByText('1.5')).not.toBeNull()
  })
})

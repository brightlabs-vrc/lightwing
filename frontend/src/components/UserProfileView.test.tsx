// @vitest-environment jsdom
import React from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, it, expect, vi } from 'vitest'
import { UserProfileView } from './UserProfileView'
import type { auth } from '../lib/client'

vi.mock('@tanstack/react-router', () => ({
  Link: React.forwardRef(({ children, to, ...props }: any, ref: any) => (
    <a ref={ref} href={to} {...props}>
      {children}
    </a>
  )),
}))

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    session: null,
  }),
}))

vi.mock('../lib/public-api', () => ({
  getLeaderboard: vi.fn().mockResolvedValue({ entries: [], total: 0 }),
  getUserRaceRecords: vi.fn().mockResolvedValue({ records: [], total: 0 }),
}))

afterEach(() => {
  cleanup()
})

describe('UserProfileView', () => {
  const mockUser: auth.UserProfile = {
    id: 'user_minori',
    name: 'Minori',
    email: 'minori@brightlabs.local',
    slug: 'sr229',
    image: '',
    vrchatUsername: 'Minori',
    biography:
      'Developer for Bright Labs. Got any questions, reach out to me on Discord!\n\n## [Support Me on Ko-fi](https://ko-fi.com/capuccino)',
    classTier: 'OP',
    siteRole: 'SITE_ADMIN',
    teams: [],
    careerOverview: '',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  }

  it('renders user biography as Markdown via MarkdownView', () => {
    const { container } = render(<UserProfileView user={mockUser} />)

    expect(screen.getByText('Minori')).toBeTruthy()
    expect(screen.getByText('@sr229')).toBeTruthy()

    const heading = container.querySelector('.markdown-content h2')
    expect(heading).not.toBeNull()
    const link = heading?.querySelector('a')
    expect(link?.textContent).toBe('Support Me on Ko-fi')
    expect(link?.getAttribute('href')).toBe('https://ko-fi.com/capuccino')
  })

  it('renders fallback text when biography is empty', () => {
    render(<UserProfileView user={{ ...mockUser, biography: '' }} />)
    expect(screen.getByText('No biography details provided yet.')).toBeTruthy()
  })
})

/**
 * @vitest-environment jsdom
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { OrganizationSearchCombobox } from './OrganizationSearchCombobox'
import * as adminApi from '../lib/admin-api'

vi.mock('../lib/admin-api', () => ({
  listAdminOrganizations: vi.fn(),
  getAdminOrganization: vi.fn(),
}))

describe('OrganizationSearchCombobox', () => {
  it('renders input with placeholder', () => {
    render(<OrganizationSearchCombobox value="" onChange={vi.fn()} />)
    expect(screen.getByPlaceholderText('Search organization by name or slug...')).toBeDefined()
  })

  it('searches organizations when user types', async () => {
    const mockOrgs = [
      {
        id: 'org_1',
        name: 'Apex Racing Org',
        slug: 'apex-racing',
        administratorSlotsRemaining: 3,
      },
    ]
    vi.mocked(adminApi.listAdminOrganizations).mockResolvedValue({
      organizations: mockOrgs as any,
      total: 1,
    })

    const onChange = vi.fn()
    const { container } = render(<OrganizationSearchCombobox value="" onChange={onChange} />)

    const input = container.querySelector('input')!
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'Apex' } })

    await waitFor(() => {
      expect(screen.getByText('Apex Racing Org')).toBeDefined()
    })

    fireEvent.click(screen.getByText('Apex Racing Org'))

    expect(onChange).toHaveBeenCalledWith('org_1', mockOrgs[0])
  })
})

import React from 'react'
import { AsyncCombobox, AsyncComboboxOption } from './AsyncCombobox'
import { listAdminTeams } from '../lib/admin-api'
import type { teammanager } from '../lib/client'

interface TeamSearchComboboxProps {
  value: string
  onChange: (teamId: string, team: teammanager.TeamListItem | null) => void
  placeholder?: string
}

export const TeamSearchCombobox: React.FC<TeamSearchComboboxProps> = ({
  value,
  onChange,
  placeholder = 'Search team by name or slug...',
}) => {
  const handleSearch = async (query: string): Promise<AsyncComboboxOption[]> => {
    try {
      const response = await listAdminTeams(query, 15, 0)
      return response.teams.map((team) => ({
        value: team.id,
        label: `${team.name} (${team.slug})`,
        subheader: `Slug: ${team.slug}`,
      }))
    } catch (err) {
      return []
    }
  }

  const handleSelect = (option: AsyncComboboxOption | null) => {
    if (!option) {
      onChange('', null)
    } else {
      onChange(option.value, { id: option.value, name: option.label, slug: option.subheader || '' } as any)
    }
  }

  return (
    <AsyncCombobox
      label="Select Competitive Team"
      placeholder={placeholder}
      onSearch={handleSearch}
      onSelect={handleSelect}
      selectedValue={value || null}
    />
  )
}
export default TeamSearchCombobox

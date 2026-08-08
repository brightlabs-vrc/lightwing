import React from 'react'
import { AsyncCombobox, AsyncComboboxOption } from './AsyncCombobox'
import { listAdminUsers } from '../lib/admin-api'
import { useAuth } from '../hooks/useAuth'

interface UserSearchComboboxProps {
  value: string
  onChange: (userId: string, user: any | null) => void
  placeholder?: string
}

export const UserSearchCombobox: React.FC<UserSearchComboboxProps> = ({
  value,
  onChange,
  placeholder = 'Search user by name, slug or email...',
}) => {
  const { session } = useAuth()
  const authHeader = session?.session.token ? `Bearer ${session.session.token}` : ''

  const handleSearch = async (query: string): Promise<AsyncComboboxOption[]> => {
    try {
      const response = await listAdminUsers(authHeader, query, 15, 0)
      return response.users.map((user) => ({
        value: user.id,
        label: `${user.name} (${user.slug || user.id})`,
        subheader: `Slug: ${user.slug || 'None'} | Email: ${user.email}`,
      }))
    } catch (err) {
      return []
    }
  }

  const handleSelect = (option: AsyncComboboxOption | null) => {
    if (!option) {
      onChange('', null)
    } else {
      onChange(option.value, { id: option.value, name: option.label })
    }
  }

  return (
    <AsyncCombobox
      label="Select System Competitor"
      placeholder={placeholder}
      onSearch={handleSearch}
      onSelect={handleSelect}
      selectedValue={value || null}
    />
  )
}
export default UserSearchCombobox

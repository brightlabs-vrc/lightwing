import React, { useState, useEffect, useRef } from 'react'
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
  const [searchTerm, setSearchTerm] = useState('')
  const [results, setResults] = useState<teammanager.TeamListItem[]>([])
  const [loading, setLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Fetch the selected team profile to display their name initially if we only have their ID
  useEffect(() => {
    if (value) {
      listAdminTeams()
        .then((res) => {
          const found = res.teams.find((t) => t.id === value)
          if (found) {
            setSearchTerm(`${found.name} (${found.slug})`)
          }
        })
        .catch(() => {
          // ignore
        })
    } else {
      setSearchTerm('')
    }
  }, [value])

  // Debounced search
  useEffect(() => {
    if (!isOpen || !searchTerm) {
      setResults([])
      return
    }

    // Do not trigger search if search term matches the current selected team profile formatting
    if (value && searchTerm.includes('(')) {
      return
    }

    const delayDebounceFn = setTimeout(() => {
      setLoading(true)
      // Since listAdminTeams now supports search/limit/offset on backend, let's call listAdminTeams with search params
      // Wait, let's check if the frontend API client matches `listAdminTeams` or if we call listTeams with query directly.
      // In frontend/src/lib/admin-api.ts, let's check if listAdminTeams has search.
      // Wait! We will update listAdminTeams to take params in a moment. Let's make sure our combobox can query it properly.
      // We can invoke appClient.teammanager.listTeams directly if listAdminTeams is not yet fully updated, or call listAdminTeams.
      // Let's call the wrapper function or API client. Since appClient is imported, calling the wrapper listAdminTeams with parameters is cleanest.
      // Let's implement it like listAdminUsers:
      // listAdminTeams(search, limit, offset)
      // We'll update frontend/src/lib/admin-api.ts right after this.
      // Let's assume listAdminTeams(searchTerm, 10, 0) is the signature.
      // Let's write the wrapper update in frontend/src/lib/admin-api.ts.
      // Yes, we will implement ListTeams with query on frontend.
      // Wait, let's query using appClient or listAdminTeams.
      // Let's write a safe listAdminTeams call.
      // Wait, can we just use listAdminTeams(searchTerm, 10, 0)? Let's update admin-api first or do it simultaneously.
      // Let's use listAdminTeams(searchTerm) which is completely safe.
      listAdminTeams(searchTerm)
        .then((res) => {
          setResults(res.teams)
        })
        .catch(() => {
          setResults([])
        })
        .finally(() => {
          setLoading(false)
        })
    }, 250)

    return () => clearTimeout(delayDebounceFn)
  }, [searchTerm, isOpen, value])

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelect = (team: teammanager.TeamListItem) => {
    onChange(team.id, team)
    setSearchTerm(`${team.name} (${team.slug})`)
    setIsOpen(false)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setSearchTerm(val)
    setIsOpen(true)
    if (!val) {
      onChange('', null)
    }
  }

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      <div className="slds-form-element__control slds-input-has-icon slds-input-has-icon_right">
        <input
          type="text"
          value={searchTerm}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          className="slds-input"
          style={{ padding: '6px 12px', border: '1px solid #dddbda', borderRadius: '4px', width: '100%' }}
        />
        {searchTerm && (
          <button
            type="button"
            onClick={() => {
              setSearchTerm('')
              onChange('', null)
              setIsOpen(false)
            }}
            style={{
              position: 'absolute',
              right: '8px',
              top: '50%',
              transform: 'translateY(-50%)',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              color: '#94a3b8',
              fontSize: '12px',
            }}
          >
            ✕
          </button>
        )}
      </div>

      {isOpen && (searchTerm && !value || results.length > 0 || loading) && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            background: '#fff',
            border: '1px solid #cbd5e1',
            borderRadius: '4px',
            marginTop: '4px',
            zIndex: 9999,
            maxHeight: '200px',
            overflowY: 'auto',
            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
          }}
        >
          {loading && (
            <div style={{ padding: '8px 12px', color: '#64748b', fontSize: '13px' }}>
              Searching teams...
            </div>
          )}

          {!loading && results.length === 0 && (
            <div style={{ padding: '8px 12px', color: '#64748b', fontSize: '13px' }}>
              No matches found
            </div>
          )}

          {!loading &&
            results.map((team) => (
              <div
                key={team.id}
                onClick={() => handleSelect(team)}
                style={{
                  padding: '8px 12px',
                  cursor: 'pointer',
                  borderBottom: '1px solid #f1f5f9',
                  fontSize: '13px',
                }}
                onMouseEnter={(e) => {
                  ;(e.currentTarget as HTMLDivElement).style.background = '#f8fafc'
                }}
                onMouseLeave={(e) => {
                  ;(e.currentTarget as HTMLDivElement).style.background = 'transparent'
                }}
              >
                <div style={{ fontWeight: '600', color: '#1e293b' }}>{team.name}</div>
                <div style={{ fontSize: '11px', color: '#64748b' }}>
                  Slug: {team.slug}
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  )
}

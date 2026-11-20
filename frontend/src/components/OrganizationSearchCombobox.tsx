import React, { useState, useEffect, useRef } from 'react'
import { listAdminOrganizations, getAdminOrganization } from '../lib/admin-api'
import type { teammanager } from '../lib/client'

interface OrganizationSearchComboboxProps {
  value: string
  onChange: (organizationId: string, org: teammanager.AdminOrganizationItem | null) => void
  placeholder?: string
}

export const OrganizationSearchCombobox: React.FC<OrganizationSearchComboboxProps> = ({
  value,
  onChange,
  placeholder = 'Search organization by name or slug...',
}) => {
  const [searchTerm, setSearchTerm] = useState('')
  const [results, setResults] = useState<teammanager.AdminOrganizationItem[]>([])
  const [loading, setLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Fetch selected organization details if value is provided and search term is empty/not matching
  useEffect(() => {
    if (value) {
      getAdminOrganization(value)
        .then((org) => {
          setSearchTerm(`${org.name} (${org.slug})`)
        })
        .catch(() => {
          listAdminOrganizations(value)
            .then((res) => {
              const found = res.organizations.find((o) => o.id === value)
              if (found) {
                setSearchTerm(`${found.name} (${found.slug})`)
              }
            })
            .catch(() => {
              // ignore
            })
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

    // Do not trigger search if search term matches the current selected profile formatting
    if (value && searchTerm.includes('(')) {
      return
    }

    const delayDebounceFn = setTimeout(() => {
      setLoading(true)
      listAdminOrganizations(searchTerm, 10, 0)
        .then((res) => {
          setResults(res.organizations)
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

  const handleSelect = (org: teammanager.AdminOrganizationItem) => {
    onChange(org.id, org)
    setSearchTerm(`${org.name} (${org.slug})`)
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
      <div style={{ position: 'relative', width: '100%' }}>
        <input
          type="text"
          value={searchTerm}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          style={{
            padding: '5px 28px 5px 12px',
            border: '1px solid var(--borderColor-default, #d0d7de)',
            borderRadius: '6px',
            width: '100%',
            fontSize: '13px',
            lineHeight: '20px',
            backgroundColor: 'var(--bgColor-default, #ffffff)',
            color: 'var(--fgColor-default, #1f2328)',
          }}
        />
        {searchTerm && (
          <button
            type="button"
            aria-label="Clear selection"
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
              color: 'var(--fgColor-muted, #636c76)',
              fontSize: '12px',
              padding: '2px',
            }}
          >
            ✕
          </button>
        )}
      </div>

      {isOpen && ((searchTerm && !value) || results.length > 0 || loading) && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            backgroundColor: 'var(--bgColor-default, #ffffff)',
            border: '1px solid var(--borderColor-default, #d0d7de)',
            borderRadius: '6px',
            marginTop: '4px',
            zIndex: 9999,
            maxHeight: '220px',
            overflowY: 'auto',
            boxShadow: '0 8px 24px rgba(140, 149, 159, 0.2)',
          }}
        >
          {loading && (
            <div style={{ padding: '8px 12px', color: 'var(--fgColor-muted, #636c76)', fontSize: '12px' }}>
              Searching organizations...
            </div>
          )}

          {!loading && results.length === 0 && (
            <div style={{ padding: '8px 12px', color: 'var(--fgColor-muted, #636c76)', fontSize: '12px' }}>
              No matches found
            </div>
          )}

          {!loading &&
            results.map((org) => (
              <div
                key={org.id}
                onClick={() => handleSelect(org)}
                style={{
                  padding: '8px 12px',
                  cursor: 'pointer',
                  borderBottom: '1px solid var(--borderColor-muted, #d8dee4)',
                  fontSize: '13px',
                }}
                onMouseEnter={(e) => {
                  ;(e.currentTarget as HTMLDivElement).style.backgroundColor = 'var(--bgColor-muted, #f6f8fa)'
                }}
                onMouseLeave={(e) => {
                  ;(e.currentTarget as HTMLDivElement).style.backgroundColor = 'transparent'
                }}
              >
                <div style={{ fontWeight: 600, color: 'var(--fgColor-default, #1f2328)' }}>{org.name}</div>
                <div style={{ fontSize: '11px', color: 'var(--fgColor-muted, #636c76)' }}>
                  @{org.slug}
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  )
}

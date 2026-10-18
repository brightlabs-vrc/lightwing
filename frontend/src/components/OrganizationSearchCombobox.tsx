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
              Searching organizations...
            </div>
          )}

          {!loading && results.length === 0 && (
            <div style={{ padding: '8px 12px', color: '#64748b', fontSize: '13px' }}>
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
                <div style={{ fontWeight: '600', color: '#1e293b' }}>{org.name}</div>
                <div style={{ fontSize: '11px', color: '#64748b' }}>
                  Slug: {org.slug}
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  )
}

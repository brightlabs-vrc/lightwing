import React, { useState, useEffect, useRef } from 'react'
import { listAdminUsers } from '../lib/admin-api'
import { useAuth } from '../hooks/useAuth'
import type { auth } from '../lib/client'

interface UserSearchComboboxProps {
  value: string
  onChange: (userId: string, user: auth.UserProfile | null) => void
  placeholder?: string
}

export const UserSearchCombobox: React.FC<UserSearchComboboxProps> = ({
  value,
  onChange,
  placeholder = 'Search user by name, @username or email...',
}) => {
  const { session } = useAuth()
  const [searchTerm, setSearchTerm] = useState('')
  const [results, setResults] = useState<auth.UserProfile[]>([])
  const [loading, setLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const containerRef = useRef<HTMLDivElement>(null)

  // Fetch the selected user profile to display their name initially if we only have their ID
  useEffect(() => {
    if (value) {
      const authHeader = session?.session.token ? `Bearer ${session.session.token}` : ''
      listAdminUsers(authHeader, '', 50, 0)
        .then((res) => {
          const found = res.users.find((u) => u.id === value)
          if (found) {
            setSearchTerm(`${found.name} (${found.slug || found.id})`)
          }
        })
        .catch(() => {
          // ignore
        })
    } else {
      setSearchTerm('')
    }
  }, [value, session?.session.token])

  // Reset highlighting when results change
  useEffect(() => {
    setHighlightedIndex(-1)
  }, [results])

  // Debounced search
  useEffect(() => {
    if (!isOpen || !searchTerm) {
      setResults([])
      return
    }

    // Do not trigger search if search term matches the current selected user profile formatting
    if (value && searchTerm.includes('(')) {
      return
    }

    const delayDebounceFn = setTimeout(() => {
      setLoading(true)
      const authHeader = session?.session.token ? `Bearer ${session.session.token}` : ''
      listAdminUsers(authHeader, searchTerm, 10, 0)
        .then((res) => {
          setResults(res.users)
        })
        .catch(() => {
          setResults([])
        })
        .finally(() => {
          setLoading(false)
        })
    }, 250)

    return () => clearTimeout(delayDebounceFn)
  }, [searchTerm, isOpen, value, session?.session.token])

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

  const handleSelect = (user: auth.UserProfile) => {
    onChange(user.id, user)
    setSearchTerm(`${user.name} (${user.slug || user.id})`)
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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        setIsOpen(true)
      }
      return
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightedIndex((prev) => (results.length > 0 ? (prev + 1) % results.length : -1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightedIndex((prev) => (results.length > 0 ? (prev - 1 + results.length) % results.length : -1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (highlightedIndex >= 0 && highlightedIndex < results.length) {
        handleSelect(results[highlightedIndex])
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setIsOpen(false)
    }
  }

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      <div style={{ position: 'relative', width: '100%' }}>
        <input
          type="text"
          value={searchTerm}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
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
              Searching users...
            </div>
          )}

          {!loading && results.length === 0 && (
            <div style={{ padding: '8px 12px', color: 'var(--fgColor-muted, #636c76)', fontSize: '12px' }}>
              No matches found
            </div>
          )}

          {!loading &&
            results.map((user, idx) => (
              <div
                key={user.id}
                onClick={() => handleSelect(user)}
                style={{
                  padding: '8px 12px',
                  cursor: 'pointer',
                  borderBottom: '1px solid var(--borderColor-muted, #d8dee4)',
                  fontSize: '13px',
                  backgroundColor: highlightedIndex === idx ? 'var(--bgColor-muted, #f6f8fa)' : 'transparent',
                }}
                onMouseEnter={() => {
                  setHighlightedIndex(idx)
                }}
              >
                <div style={{ fontWeight: 600, color: 'var(--fgColor-default, #1f2328)' }}>{user.name}</div>
                <div style={{ fontSize: '11px', color: 'var(--fgColor-muted, #636c76)' }}>
                  @{user.slug || 'none'} · {user.email}
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  )
}

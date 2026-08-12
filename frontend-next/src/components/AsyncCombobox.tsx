'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Autocomplete, ActionList, Spinner, IconButton } from '@primer/react'
import { SearchIcon, XIcon } from '@primer/octicons-react'

export interface AsyncComboboxOption {
  value: string
  label: string
  subheader?: string
}

interface AsyncComboboxProps {
  label: string
  placeholder?: string
  onSearch: (query: string) => Promise<AsyncComboboxOption[]>
  onSelect: (option: AsyncComboboxOption | null) => void
  selectedValue: string | null
  selectedLabel?: string
  disabled?: boolean
  required?: boolean
  error?: string
}

export const AsyncCombobox: React.FC<AsyncComboboxProps> = ({
  label,
  placeholder = 'Search...',
  onSearch,
  onSelect,
  selectedValue,
  selectedLabel,
  disabled = false,
  required = false,
  error,
}) => {
  const [query, setQuery] = useState('')
  const [options, setOptions] = useState<AsyncComboboxOption[]>([])
  const [loading, setLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)

  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const currentRequestIdRef = useRef(0)

  const [displayLabel, setDisplayLabel] = useState(selectedLabel || selectedValue || '')

  useEffect(() => {
    if (selectedLabel) {
      setDisplayLabel(selectedLabel)
    } else if (selectedValue) {
      setDisplayLabel(selectedValue)
    } else {
      setDisplayLabel('')
    }
  }, [selectedValue, selectedLabel])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setQuery(val)
    setIsOpen(true)

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    if (!val.trim()) {
      setOptions([])
      return
    }

    setLoading(true)
    const reqId = ++currentRequestIdRef.current

    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const results = await onSearch(val)
        if (reqId === currentRequestIdRef.current) {
          setOptions(results)
        }
      } catch (err) {
        if (reqId === currentRequestIdRef.current) {
          setOptions([])
        }
      } finally {
        if (reqId === currentRequestIdRef.current) {
          setLoading(false)
        }
      }
    }, 300)
  }

  const handleSelect = (item: any) => {
    if (!item) {
      onSelect(null)
      setQuery('')
      setOptions([])
      setIsOpen(false)
      return
    }
    const option = options.find((o) => o.value === item.id)
    if (option) {
      onSelect(option)
      setDisplayLabel(option.label)
      setQuery('')
      setIsOpen(false)
    }
  }

  const handleClear = () => {
    onSelect(null)
    setQuery('')
    setOptions([])
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
        <span style={{ fontWeight: 'bold', fontSize: '14px' }}>{label}</span>
        {required && <span style={{ color: 'var(--color-danger-fg)' }}>*</span>}
      </div>

      {selectedValue ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            border: '1px solid var(--color-border-default)',
            borderRadius: '6px',
            padding: '0.5rem',
            backgroundColor: 'var(--color-canvas-subtle)',
          }}
        >
          <span style={{ fontSize: '14px' }}>{displayLabel}</span>
          <IconButton
            icon={XIcon}
            aria-label="Clear selection"
            size="small"
            variant="invisible"
            onClick={handleClear}
            disabled={disabled}
          />
        </div>
      ) : (
        <Autocomplete>
          <Autocomplete.Input
            value={query}
            onChange={handleInputChange}
            placeholder={placeholder}
            disabled={disabled}
            leadingVisual={SearchIcon}
            aria-invalid={!!error}
          />
          {isOpen && (
            <Autocomplete.Overlay>
              <ActionList>
                {loading && (
                  <ActionList.Item disabled>
                    <ActionList.LeadingVisual>
                      <Spinner size="small" />
                    </ActionList.LeadingVisual>
                    Searching...
                  </ActionList.Item>
                )}
                {!loading && options.length === 0 && query.trim() !== '' && (
                  <ActionList.Item disabled>No results found</ActionList.Item>
                )}
                {!loading &&
                  options.map((option) => (
                    <ActionList.Item
                      key={option.value}
                      id={option.value}
                      onSelect={() => handleSelect({ id: option.value })}
                    >
                      {option.label}
                      {option.subheader && (
                        <ActionList.Description>{option.subheader}</ActionList.Description>
                      )}
                    </ActionList.Item>
                  ))}
              </ActionList>
            </Autocomplete.Overlay>
          )}
        </Autocomplete>
      )}

      {error && <span style={{ color: 'var(--color-danger-fg)', fontSize: '12px' }}>{error}</span>}
    </div>
  )
}

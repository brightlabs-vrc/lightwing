import React, { useState, useEffect, useRef } from 'react'
import type { eventmanager } from '../lib/client'
import { AlertBanner } from './AlertBanner'
import { Heading, Text, Label, Button, TextInput, FormControl, Spinner, Select } from '@primer/react'
import { SearchIcon, XIcon } from '@primer/octicons-react'

function formatClassTier(tier: string | null | undefined): string {
  if (!tier || tier === 'PRE_OP' || tier === 'OP') {
    return 'None'
  }
  return tier
}
import { StandingsEditor } from './StandingsEditor'
import { UserLink } from './UserLink'
import {
  isRaceOngoing,
  isRaceNotStarted,
} from '../lib/raceStatus'

interface RaceMemberComboboxProps {
  value: string
  onChange: (userId: string) => void
  members: eventmanager.EventMemberView[]
  placeholder?: string
}

export const RaceMemberCombobox: React.FC<RaceMemberComboboxProps> = ({
  value,
  onChange,
  members,
  placeholder = 'Search competitor from event members...',
}) => {
  const [searchTerm, setSearchTerm] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (value) {
      const found = members.find((m) => m.userId === value)
      if (found) {
        setSearchTerm(`${found.name} (${formatClassTier(found.classTier)})`)
      }
    } else {
      setSearchTerm('')
    }
  }, [value, members])

  const filtered = members.filter((m) => {
    if (!searchTerm || value) return true
    const term = searchTerm.toLowerCase()
    return (
      m.name.toLowerCase().includes(term) ||
      m.userId.toLowerCase().includes(term) ||
      formatClassTier(m.classTier).toLowerCase().includes(term)
    )
  })

  useEffect(() => {
    setHighlightedIndex(-1)
  }, [searchTerm])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelect = (member: eventmanager.EventMemberView) => {
    onChange(member.userId)
    setSearchTerm(`${member.name} (${formatClassTier(member.classTier)})`)
    setIsOpen(false)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setSearchTerm(val)
    setIsOpen(true)
    if (!val) {
      onChange('')
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
      setHighlightedIndex((prev) => (filtered.length > 0 ? (prev + 1) % filtered.length : -1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightedIndex((prev) => (filtered.length > 0 ? (prev - 1 + filtered.length) % filtered.length : -1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (highlightedIndex >= 0 && highlightedIndex < filtered.length) {
        handleSelect(filtered[highlightedIndex])
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setIsOpen(false)
    }
  }

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      <div style={{ position: 'relative', width: '100%', display: 'flex', alignItems: 'center' }}>
        <TextInput
          value={searchTerm}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          width="100%"
          leadingVisual={SearchIcon}
        />
        {searchTerm && (
          <button
            type="button"
            onClick={() => {
              setSearchTerm('')
              onChange('')
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
              color: 'var(--color-fg-muted)',
              fontSize: '12px',
              zIndex: 10
            }}
          >
            ✕
          </button>
        )}
      </div>

      {isOpen && (searchTerm && !value || filtered.length > 0) && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            background: 'var(--color-canvas-default)',
            border: '1px solid var(--color-border-default)',
            borderRadius: '6px',
            marginTop: '4px',
            zIndex: 9999,
            maxHeight: '150px',
            overflowY: 'auto',
            boxShadow: 'var(--color-shadow-medium)',
          }}
        >
          {filtered.length === 0 && (
            <div style={{ padding: '6px 12px', color: 'var(--color-fg-muted)', fontSize: '12px' }}>
              No matches found
            </div>
          )}

          {filtered.map((member, idx) => (
            <div
              key={member.userId}
              onClick={() => handleSelect(member)}
              style={{
                padding: '6px 12px',
                cursor: 'pointer',
                borderBottom: '1px solid var(--color-border-default)',
                fontSize: '12px',
                background: highlightedIndex === idx ? 'var(--color-canvas-subtle)' : 'transparent',
              }}
              onMouseEnter={(e) => {
                setHighlightedIndex(idx)
              }}
            >
              <div style={{ fontWeight: '600', color: 'var(--color-fg-default)' }}>{member.name}</div>
              <div style={{ fontSize: '10px', color: 'var(--color-fg-muted)' }}>
                ID: {member.userId} | Class: {formatClassTier(member.classTier)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

interface RaceDetailPaneProps {
  selectedEvent: eventmanager.EventDetail
  selectedRace: eventmanager.RaceEventDetail | null
  selectedRaceId: string | null
  setSelectedRaceId: (id: string | null) => void
  newRaceMemberUserId: string
  setNewRaceMemberUserId: (id: string) => void
  CLASS_TIER_OPTIONS: string[]
  handleUpdateRace: (raceId: string, params: any) => Promise<void>
  handleStartRace: (raceId: string) => Promise<void>
  handleEndRace: (raceId: string) => Promise<void>
  handleDeleteRace: (raceId: string) => Promise<void>
  handleAddRaceMember: (raceId: string, userId: string) => Promise<void>
  handleRemoveRaceMember: (raceId: string, userId: string) => Promise<void>
  setShowEditRaceModal: (show: boolean) => void
  setShowCreateRaceModal: (show: boolean) => void
  loadingResults: boolean
  derivedStates: any[]
  changeSummary: any
  savingBatch: boolean
  handleInferFinishTimes: () => void
  handleCancelStandingsEdit: () => void
  handleUnifiedSave: () => Promise<void>
  resetStandingsDraft: () => void
  handleResultChange: (userId: string, field: any, value: string) => void
  togglePendingDeletion: (userId: string) => void
  handleUndoRow: (userId: string) => void
}

export function RaceDetailPane({
  selectedEvent,
  selectedRace,
  selectedRaceId,
  setSelectedRaceId,
  newRaceMemberUserId,
  setNewRaceMemberUserId,
  CLASS_TIER_OPTIONS,
  handleUpdateRace,
  handleStartRace,
  handleEndRace,
  handleDeleteRace,
  handleAddRaceMember,
  handleRemoveRaceMember,
  setShowEditRaceModal,
  setShowCreateRaceModal,
  loadingResults,
  derivedStates,
  changeSummary,
  savingBatch,
  handleInferFinishTimes,
  handleCancelStandingsEdit,
  handleUnifiedSave,
  resetStandingsDraft,
  handleResultChange,
  togglePendingDeletion,
  handleUndoRow,
}: RaceDetailPaneProps) {
  if (selectedRaceId === null || !selectedRace) {
    return (
      <div style={{
        backgroundColor: 'var(--color-canvas-default)',
        borderRadius: '6px',
        border: '1px solid var(--color-border-default)',
        minHeight: '400px',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        textAlign: 'center',
        boxShadow: 'var(--color-shadow-small)'
      }}>
        <div style={{ padding: '2rem' }}>
          <Heading as="h3" style={{ fontSize: '20px', fontWeight: 'bold' }}>
            No race selected
          </Heading>
          <Text style={{ fontSize: '14px', color: 'var(--color-fg-muted)', display: 'block', maxWidth: '360px', margin: '8px auto 0 auto', lineHeight: '1.5' }}>
            Select a race track from the left panel to begin managing competitors, recording standings, and starting or concluding races.
          </Text>
          <Button
            variant="primary"
            onClick={() => setShowCreateRaceModal(true)}
            style={{ marginTop: '1.5rem' }}
          >
            Create Race Track
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Race Details Header Card */}
      <div style={{
        backgroundColor: 'var(--color-canvas-default)',
        border: '1px solid var(--color-border-default)',
        borderRadius: '6px',
        padding: '1.5rem',
        boxShadow: 'var(--color-shadow-small)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', alignItems: 'center' }}>
          <div>
            <Heading as="h3" style={{ fontSize: '18px', fontWeight: 'bold', margin: 0 }}>
              #{selectedRace.sequence}. {selectedRace.name}
            </Heading>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginTop: '4px' }}>
              <span style={{ fontSize: '12px', color: 'var(--color-fg-muted)' }}>
                Type: <strong>{selectedRace.trackType} ({selectedRace.distanceMeters}m)</strong> | Location: <strong>{selectedRace.location}</strong>
              </span>
              <Label variant="default">
                Class Restriction: <strong>{formatClassTier(selectedRace.classRestriction)}</strong>
              </Label>
              {selectedEvent.granularParticipation && (
                <Label variant="default">
                  Capacity: <strong>{selectedRace.participantLimit !== null ? `${(selectedRace.members ?? []).length} / ${selectedRace.participantLimit}` : `${(selectedRace.members ?? []).length}`}</strong>
                </Label>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <FormControl>
              <FormControl.Label style={{ fontWeight: 'bold', fontSize: '12px' }}>
                Class Restriction:
              </FormControl.Label>
              <Select
                value={(!selectedRace.classRestriction || selectedRace.classRestriction === 'PRE_OP' || selectedRace.classRestriction === 'OP') ? '' : selectedRace.classRestriction}
                onChange={(e) => void handleUpdateRace(selectedRace.id, { classRestriction: e.target.value ? e.target.value as eventmanager.ClassTier : null })}
                size="small"
              >
                <option value="">Any Tier (None)</option>
                {CLASS_TIER_OPTIONS.map((tier) => (
                  <option key={tier} value={tier}>
                    {tier}
                  </option>
                ))}
              </Select>
            </FormControl>

            {selectedEvent.scoringType === 1 && (
              <FormControl>
                <FormControl.Label style={{ fontWeight: 'bold', fontSize: '12px' }}>
                  Grade:
                </FormControl.Label>
                <Select
                  value={selectedRace.grade || ''}
                  onChange={(e) => void handleUpdateRace(selectedRace.id, { grade: e.target.value || null })}
                  size="small"
                >
                  <option value="">-- None --</option>
                  <option value="OP">OP</option>
                  <option value="GIII">GIII</option>
                  <option value="GII">GII</option>
                  <option value="GI">GI</option>
                </Select>
              </FormControl>
            )}

            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              <Button size="small" onClick={() => setShowEditRaceModal(true)}>
                Edit Race
              </Button>
              {isRaceNotStarted(selectedRace) && (
                <Button
                  size="small"
                  onClick={() => void handleStartRace(selectedRace.id)}
                  style={{ backgroundColor: 'var(--color-success-emphasis)', color: 'var(--color-fg-on-emphasis)' }}
                >
                  Start Race
                </Button>
              )}
              {isRaceOngoing(selectedRace) && (
                <Button
                  size="small"
                  onClick={() => void handleEndRace(selectedRace.id)}
                  style={{ backgroundColor: 'var(--color-danger-emphasis)', color: 'var(--color-fg-on-emphasis)' }}
                >
                  End Race
                </Button>
              )}
              <Button
                size="small"
                onClick={() => void handleDeleteRace(selectedRace.id)}
                style={{ color: 'var(--color-danger-fg)' }}
              >
                Delete
              </Button>
              <Button
                size="small"
                onClick={() => {
                  setSelectedRaceId(null)
                }}
              >
                Clear
              </Button>
            </div>
          </div>
        </div>

        <div style={{ fontSize: '11px', color: 'var(--color-fg-muted)', borderTop: '1px solid var(--color-border-default)', paddingTop: '8px', marginTop: '12px' }}>
          {selectedRace.startsAt ? `Started: ${new Date(selectedRace.startsAt).toLocaleString()}` : 'Race is currently not started'} <br />
          {selectedRace.endsAt ? `Ended: ${new Date(selectedRace.endsAt).toLocaleString()}` : ''}
          {selectedRace.grade && (
            <span style={{ float: 'right' }}>
              Scoring Table: <strong>{selectedRace.grade}</strong> | Source: <strong>{selectedEvent.scoringRulesMode === 'CUSTOM' ? 'Event Custom Rules' : 'Event Standard Rules'}</strong>
            </span>
          )}
        </div>
      </div>

      {/* Warning Banner if points-based event but race has no grade */}
      {selectedEvent.scoringType === 1 && !selectedRace.grade && (
        <AlertBanner variant="error">
          <div style={{ textAlign: 'left' }}>
            <strong>Missing Race Grade Configuration</strong>
            <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: 'var(--color-danger-fg)' }}>
              This event is points-based, but this race has no grade configured. Points for its results will resolve to <strong>0</strong> until a grade is configured.
            </p>
          </div>
        </AlertBanner>
      )}

      {/* Granular Participant lineup box */}
      {selectedEvent.granularParticipation && (
        <div style={{
          backgroundColor: 'var(--color-canvas-default)',
          border: '1px solid var(--color-border-default)',
          borderRadius: '6px',
          padding: '1.5rem',
          boxShadow: 'var(--color-shadow-small)'
        }}>
          <Heading as="h3" style={{ fontSize: '16px', fontWeight: 'bold', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <span>Competitor Lineup</span>
            <Label variant="default">
              {(selectedRace.members ?? []).length} Registered
            </Label>
          </Heading>

          <div style={{
            backgroundColor: 'var(--color-canvas-subtle)',
            border: '1px solid var(--color-border-default)',
            padding: '8px 12px',
            borderRadius: '6px',
            marginBottom: '1rem'
          }}>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                void handleAddRaceMember(selectedRace.id, newRaceMemberUserId)
              }}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}
            >
              <div style={{ flexGrow: 1, minWidth: '180px' }}>
                <RaceMemberCombobox
                  value={newRaceMemberUserId}
                  onChange={(val) => setNewRaceMemberUserId(val)}
                  members={selectedEvent.members.filter(
                    (em) => !(selectedRace.members ?? []).some((rm) => rm.userId === em.userId)
                  )}
                />
              </div>
              <Button
                type="submit"
                variant="primary"
                size="small"
                disabled={!newRaceMemberUserId}
              >
                Add
              </Button>
            </form>
          </div>

          {(selectedRace.members?.length ?? 0) === 0 ? (
            <p style={{ fontSize: '11px', color: 'var(--color-fg-muted)', margin: 0 }}>No competitors registered specifically for this race yet.</p>
          ) : (
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {(selectedRace.members ?? []).map((m) => (
                <Label
                  key={m.userId}
                  variant="accent"
                  style={{
                    padding: '4px 8px',
                    fontSize: '11px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <UserLink userId={m.userId} name={m.name} />
                  <button
                    type="button"
                    onClick={() => void handleRemoveRaceMember(selectedRace.id, m.userId)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--color-danger-fg)',
                      cursor: 'pointer',
                      fontWeight: 'bold',
                      padding: 0,
                    }}
                    title="Remove competitor"
                  >
                    ✕
                  </button>
                </Label>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Dynamic Standings editor grid */}
      <StandingsEditor
        raceName={selectedRace.name}
        isRaceOngoing={isRaceOngoing(selectedRace)}
        isRaceNotStarted={isRaceNotStarted(selectedRace)}
        loadingResults={loadingResults}
        memberCount={selectedEvent.granularParticipation ? (selectedRace.members?.length ?? 0) : selectedEvent.members.length}
        rows={derivedStates}
        changeSummary={changeSummary}
        savingBatch={savingBatch}
        onInferTimes={handleInferFinishTimes}
        onCancel={handleCancelStandingsEdit}
        onSave={handleUnifiedSave}
        onResetAll={resetStandingsDraft}
        onResultChange={handleResultChange}
        onTogglePendingDeletion={togglePendingDeletion}
        onUndoRow={handleUndoRow}
        noTopMargin={true}
        scoringType={selectedEvent.scoringType}
        scoringRulesMode={selectedEvent.scoringRulesMode}
        customScoringTables={selectedEvent.customScoringTables}
        raceGrade={selectedRace.grade}
      />
    </div>
  )
}

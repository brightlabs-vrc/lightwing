import React, { useState, useEffect, useRef } from 'react'
import type { eventmanager } from '../lib/client'
import type { ClassTier } from '../types'
import { AlertBanner } from './AlertBanner'

function formatClassTier(tier: string | null | undefined): string {
  if (!tier || tier === 'PRE_OP' || tier === 'OP') {
    return 'None'
  }
  return tier
}
import { StandingsEditor } from './StandingsEditor'
import { UserLink } from './UserLink'
import { UserSearchCombobox } from './UserSearchCombobox'
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
            backgroundColor: 'var(--bgColor-default, #ffffff)',
            color: 'var(--fgColor-default, #1f2328)',
            fontSize: '12px',
            lineHeight: '20px',
          }}
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
              color: 'var(--fgColor-muted, #636c76)',
              fontSize: '12px',
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
            background: '#fff',
            border: '1px solid #cbd5e1',
            borderRadius: '4px',
            marginTop: '4px',
            zIndex: 9999,
            maxHeight: '150px',
            overflowY: 'auto',
            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
          }}
        >
          {filtered.length === 0 && (
            <div style={{ padding: '6px 12px', color: '#64748b', fontSize: '12px' }}>
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
                borderBottom: '1px solid #f1f5f9',
                fontSize: '12px',
                background: highlightedIndex === idx ? '#f1f5f9' : 'transparent',
              }}
              onMouseEnter={(e) => {
                setHighlightedIndex(idx)
              }}
            >
              <div style={{ fontWeight: '600', color: '#1e293b' }}>{member.name}</div>
              <div style={{ fontSize: '10px', color: '#64748b' }}>
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
      <div
        className="primer-box"
        style={{
          minHeight: '360px',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          textAlign: 'center',
          padding: '32px',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
          <p style={{ margin: 0, fontWeight: 600, fontSize: '16px', color: 'var(--fgColor-default, #1f2328)' }}>
            No race selected
          </p>
          <p style={{ margin: 0, fontSize: '13px', maxWidth: '360px', color: 'var(--fgColor-muted, #636c76)', lineHeight: 1.5 }}>
            Select a race track from the left panel to manage competitors, record standings, and start or conclude races.
          </p>
          <button
            type="button"
            onClick={() => setShowCreateRaceModal(true)}
            style={{
              marginTop: '8px',
              padding: '6px 14px',
              borderRadius: '6px',
              border: '1px solid rgba(31, 35, 40, 0.15)',
              backgroundColor: 'var(--bgColor-success-emphasis, #1f883d)',
              color: '#ffffff',
              fontWeight: 500,
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            Create Race Track
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Race Details Header Card */}
      <div className="primer-box" style={{ padding: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h3 style={{ fontWeight: 600, fontSize: '16px', margin: 0, color: 'var(--fgColor-default, #1f2328)' }}>
              #{selectedRace.sequence}. {selectedRace.name}
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginTop: '6px' }}>
              <span style={{ fontSize: '12px', color: 'var(--fgColor-muted, #636c76)' }}>
                Type: <strong>{selectedRace.trackType} ({selectedRace.distanceMeters}m)</strong> · Location:{' '}
                <strong>{selectedRace.location}</strong>
              </span>
              <span
                style={{
                  padding: '2px 8px',
                  fontSize: '11px',
                  borderRadius: '999px',
                  border: '1px solid var(--borderColor-default, #d0d7de)',
                  backgroundColor: 'var(--bgColor-muted, #f6f8fa)',
                  color: 'var(--fgColor-default, #1f2328)',
                }}
              >
                Class: <strong>{formatClassTier(selectedRace.classRestriction)}</strong>
              </span>
              {selectedEvent.granularParticipation && (
                <span
                  style={{
                    padding: '2px 8px',
                    fontSize: '11px',
                    borderRadius: '999px',
                    border: '1px solid var(--borderColor-default, #d0d7de)',
                    backgroundColor: 'var(--bgColor-muted, #f6f8fa)',
                    color: 'var(--fgColor-default, #1f2328)',
                  }}
                >
                  Capacity:{' '}
                  <strong>
                    {selectedRace.participantLimit !== null
                      ? `${(selectedRace.members ?? []).length} / ${selectedRace.participantLimit}`
                      : `${(selectedRace.members ?? []).length}`}
                  </strong>
                </span>
              )}
              {selectedEvent.isTeamEvent && selectedRace.maxMembersPerTeam !== null && (
                <span
                  style={{
                    padding: '2px 8px',
                    fontSize: '11px',
                    borderRadius: '999px',
                    border: '1px solid var(--borderColor-default, #d0d7de)',
                    backgroundColor: 'var(--bgColor-muted, #f6f8fa)',
                    color: 'var(--fgColor-default, #1f2328)',
                  }}
                >
                  Max / Team: <strong>{selectedRace.maxMembersPerTeam}</strong>
                </span>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <label
                htmlFor="race-class-restriction-select"
                style={{ fontWeight: 600, fontSize: '12px', color: 'var(--fgColor-muted, #636c76)' }}
              >
                Class:
              </label>
              <select
                id="race-class-restriction-select"
                value={
                  !selectedRace.classRestriction ||
                  selectedRace.classRestriction === 'PRE_OP' ||
                  selectedRace.classRestriction === 'OP'
                    ? ''
                    : selectedRace.classRestriction
                }
                onChange={(e) =>
                  void handleUpdateRace(selectedRace.id, {
                    classRestriction: e.target.value ? (e.target.value as ClassTier) : null,
                  })
                }
                style={{
                  padding: '4px 8px',
                  border: '1px solid var(--borderColor-default, #d0d7de)',
                  borderRadius: '6px',
                  fontSize: '12px',
                  backgroundColor: 'var(--bgColor-default, #ffffff)',
                  color: 'var(--fgColor-default, #1f2328)',
                }}
              >
                <option value="">Any Tier (None)</option>
                {CLASS_TIER_OPTIONS.map((tier) => (
                  <option key={tier} value={tier}>
                    {tier}
                  </option>
                ))}
              </select>
            </div>

            {selectedEvent.scoringType === 1 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <label
                  htmlFor="race-grade-select"
                  style={{ fontWeight: 600, fontSize: '12px', color: 'var(--fgColor-muted, #636c76)' }}
                >
                  Grade:
                </label>
                <select
                  id="race-grade-select"
                  value={selectedRace.grade || ''}
                  onChange={(e) => void handleUpdateRace(selectedRace.id, { grade: e.target.value || null })}
                  style={{
                    padding: '4px 8px',
                    border: '1px solid var(--borderColor-default, #d0d7de)',
                    borderRadius: '6px',
                    fontSize: '12px',
                    backgroundColor: 'var(--bgColor-default, #ffffff)',
                    color: 'var(--fgColor-default, #1f2328)',
                  }}
                >
                  <option value="">-- None --</option>
                  <option value="OP">OP</option>
                  <option value="GIII">GIII</option>
                  <option value="GII">GII</option>
                  <option value="GI">GI</option>
                </select>
              </div>
            )}

            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setShowEditRaceModal(true)}
                style={{
                  padding: '4px 10px',
                  fontSize: '12px',
                  fontWeight: 500,
                  borderRadius: '6px',
                  border: '1px solid var(--borderColor-default, #d0d7de)',
                  backgroundColor: 'var(--bgColor-default, #ffffff)',
                  color: 'var(--fgColor-default, #1f2328)',
                  cursor: 'pointer',
                }}
              >
                Edit Race
              </button>
              {isRaceNotStarted(selectedRace) && (
                <button
                  type="button"
                  onClick={() => void handleStartRace(selectedRace.id)}
                  style={{
                    padding: '4px 10px',
                    fontSize: '12px',
                    fontWeight: 500,
                    borderRadius: '6px',
                    border: '1px solid rgba(31, 35, 40, 0.15)',
                    backgroundColor: 'var(--bgColor-success-emphasis, #1f883d)',
                    color: '#ffffff',
                    cursor: 'pointer',
                  }}
                >
                  Start Race
                </button>
              )}
              {isRaceOngoing(selectedRace) && (
                <button
                  type="button"
                  onClick={() => void handleEndRace(selectedRace.id)}
                  style={{
                    padding: '4px 10px',
                    fontSize: '12px',
                    fontWeight: 500,
                    borderRadius: '6px',
                    border: '1px solid rgba(31, 35, 40, 0.15)',
                    backgroundColor: 'var(--bgColor-danger-emphasis, #cf222e)',
                    color: '#ffffff',
                    cursor: 'pointer',
                  }}
                >
                  End Race
                </button>
              )}
              <button
                type="button"
                onClick={() => void handleDeleteRace(selectedRace.id)}
                style={{
                  padding: '4px 10px',
                  fontSize: '12px',
                  fontWeight: 500,
                  borderRadius: '6px',
                  border: '1px solid var(--borderColor-default, #d0d7de)',
                  backgroundColor: 'var(--bgColor-default, #ffffff)',
                  color: 'var(--fgColor-danger, #d1242f)',
                  cursor: 'pointer',
                }}
              >
                Delete
              </button>
              <button
                type="button"
                onClick={() => setSelectedRaceId(null)}
                style={{
                  padding: '4px 10px',
                  fontSize: '12px',
                  fontWeight: 500,
                  borderRadius: '6px',
                  border: '1px solid var(--borderColor-default, #d0d7de)',
                  backgroundColor: 'var(--bgColor-muted, #f6f8fa)',
                  color: 'var(--fgColor-muted, #636c76)',
                  cursor: 'pointer',
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>

        <div
          style={{
            fontSize: '12px',
            color: 'var(--fgColor-muted, #636c76)',
            borderTop: '1px solid var(--borderColor-muted, #d8dee4)',
            paddingTop: '8px',
            marginTop: '10px',
            display: 'flex',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '8px',
          }}
        >
          <div>
            {selectedRace.startsAt ? `Started: ${new Date(selectedRace.startsAt).toLocaleString()}` : 'Not started'}
            {selectedRace.endsAt ? ` · Ended: ${new Date(selectedRace.endsAt).toLocaleString()}` : ''}
          </div>
          {selectedRace.grade && (
            <div>
              Scoring Table: <strong>{selectedRace.grade}</strong> · Source:{' '}
              <strong>{selectedEvent.scoringRulesMode === 'CUSTOM' ? 'Custom Rules' : 'Standard Rules'}</strong>
            </div>
          )}
        </div>
      </div>

      {selectedEvent.scoringType === 1 && !selectedRace.grade && (
        <AlertBanner variant="error">
          <div>
            <strong>Missing Race Grade Configuration</strong>
            <p style={{ margin: '2px 0 0 0', fontSize: '12px' }}>
              This event is points-based, but this race has no grade configured. Points for its results will resolve to{' '}
              <strong>0</strong> until a grade is configured.
            </p>
          </div>
        </AlertBanner>
      )}

      {/* Granular or Team Event Participant lineup box */}
      {(selectedEvent.granularParticipation || selectedEvent.isTeamEvent) && (
        <div className="primer-box" style={{ padding: '14px 16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
            <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>
              {selectedEvent.isTeamEvent ? 'Race Lineup (Primary Roster Only)' : 'Competitor Lineup'}
            </h3>
            <span
              style={{
                padding: '2px 8px',
                fontSize: '11px',
                fontWeight: 500,
                borderRadius: '999px',
                backgroundColor: 'var(--bgColor-muted, #f6f8fa)',
                border: '1px solid var(--borderColor-default, #d0d7de)',
              }}
            >
              {(selectedRace.members ?? []).length} Registered
            </span>
          </div>

          {selectedEvent.isTeamEvent && (
            <p style={{ margin: '0 0 10px 0', fontSize: '12px', color: 'var(--fgColor-muted, #636c76)' }}>
              Only <strong>PRIMARY</strong> team roster members appear below. To use a <strong>BACKUP</strong> member, sub them into the Primary Roster on the <strong>Event Members / Teams</strong> tab first.
            </p>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault()
              void handleAddRaceMember(selectedRace.id, newRaceMemberUserId)
            }}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}
          >
            <div style={{ flexGrow: 1, minWidth: '180px' }}>
              {selectedEvent.isTeamEvent ? (
                <RaceMemberCombobox
                  value={newRaceMemberUserId}
                  onChange={(val) => setNewRaceMemberUserId(val)}
                  placeholder="Select competitor from registered teams' PRIMARY rosters..."
                  members={selectedEvent.members
                    .filter(
                      (em) =>
                        em.rosterRole === 'PRIMARY' &&
                        !(selectedRace.members ?? []).some((rm) => rm.userId === em.userId),
                    )
                    .map((em) => ({
                      ...em,
                      name: em.teamName ? `${em.name} [${em.teamName}]` : em.name,
                    }))}
                />
              ) : selectedEvent.granularParticipation ? (
                <UserSearchCombobox value={newRaceMemberUserId} onChange={(val) => setNewRaceMemberUserId(val)} />
              ) : (
                <RaceMemberCombobox
                  value={newRaceMemberUserId}
                  onChange={(val) => setNewRaceMemberUserId(val)}
                  members={selectedEvent.members.filter(
                    (em) => !(selectedRace.members ?? []).some((rm) => rm.userId === em.userId),
                  )}
                />
              )}
            </div>
            <button
              type="submit"
              disabled={!newRaceMemberUserId}
              style={{
                padding: '5px 12px',
                fontSize: '12px',
                fontWeight: 500,
                borderRadius: '6px',
                border: '1px solid rgba(31, 35, 40, 0.15)',
                backgroundColor: newRaceMemberUserId ? 'var(--bgColor-success-emphasis, #1f883d)' : 'var(--bgColor-muted, #f6f8fa)',
                color: newRaceMemberUserId ? '#ffffff' : 'var(--fgColor-disabled, #8c959f)',
                cursor: newRaceMemberUserId ? 'pointer' : 'not-allowed',
              }}
            >
              Add
            </button>
          </form>

          {(selectedRace.members?.length ?? 0) === 0 ? (
            <p style={{ fontSize: '12px', color: 'var(--fgColor-muted, #636c76)', margin: 0 }}>
              No competitors registered specifically for this race yet.
            </p>
          ) : (
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {(selectedRace.members ?? []).map((m) => (
                <span
                  key={m.userId}
                  style={{
                    padding: '3px 8px',
                    fontSize: '12px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    borderRadius: '999px',
                    border: '1px solid var(--borderColor-default, #d0d7de)',
                    backgroundColor: 'var(--bgColor-muted, #f6f8fa)',
                  }}
                >
                  <UserLink userId={m.userId} name={m.name} />
                  {m.teamName && (
                    <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--fgColor-accent, #0969da)' }}>
                      [{m.teamName}]
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => void handleRemoveRaceMember(selectedRace.id, m.userId)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--fgColor-danger, #d1242f)',
                      cursor: 'pointer',
                      fontWeight: 700,
                      padding: 0,
                      lineHeight: 1,
                    }}
                    title="Remove competitor"
                  >
                    ✕
                  </button>
                </span>
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
        memberCount={derivedStates.length}
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

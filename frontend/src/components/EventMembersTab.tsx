import { useEffect, useState } from 'react'
import { Button, Flash, Label } from '@primer/react'
import { ArrowSwitchIcon, PersonAddIcon, TrashIcon } from '@primer/octicons-react'
import type { eventmanager, teammanager } from '../lib/client'
import { listAdminTeamMembers } from '../lib/admin-api'
import { UserSearchCombobox } from './UserSearchCombobox'
import { TeamSearchCombobox } from './TeamSearchCombobox'
import { UserLink } from './UserLink'

interface EventMembersTabProps {
  selectedEvent: eventmanager.EventDetail
  newMemberUserId: string
  setNewMemberUserId: (id: string) => void
  handleAddMember: (evt: React.FormEvent) => void
  handleRemoveMember: (userId: string) => void
  handleUpsertEventTeamRoster?: (
    teamId: string,
    primaryUserIds: string[],
    backupUserIds: string[],
  ) => Promise<boolean>
  handleSubstituteTeamMember?: (
    teamId: string,
    incomingUserId: string,
    outgoingUserId?: string | null,
    replaceInUpcomingRaces?: boolean,
  ) => Promise<boolean>
  handleRemoveEventTeam?: (teamId: string) => Promise<void>
}

export function EventMembersTab({
  selectedEvent,
  newMemberUserId,
  setNewMemberUserId,
  handleAddMember,
  handleRemoveMember,
  handleUpsertEventTeamRoster,
  handleSubstituteTeamMember,
  handleRemoveEventTeam,
}: EventMembersTabProps) {
  const isGranular = selectedEvent.granularParticipation
  const isTeamEvent = selectedEvent.isTeamEvent

  // Team roster builder state (for team-based events)
  const [selectedTeamId, setSelectedTeamId] = useState('')
  const [selectedTeamObj, setSelectedTeamObj] = useState<teammanager.TeamListItem | null>(null)
  const [teamMembers, setTeamMembers] = useState<Array<{ userId: string; name: string; slug?: string | null; role: string }>>([])
  const [loadingTeamMembers, setLoadingTeamMembers] = useState(false)
  const [rosterAssignments, setRosterAssignments] = useState<Record<string, 'NONE' | 'PRIMARY' | 'BACKUP'>>({})
  const [savingTeamRoster, setSavingTeamRoster] = useState(false)

  // Per-backup swap target state: backupUserId -> outgoingPrimaryUserId (empty = direct promote)
  const [swapTargets, setSwapTargets] = useState<Record<string, string>>({})
  const [replaceUpcoming, setReplaceUpcoming] = useState(true)

  useEffect(() => {
    if (!isTeamEvent || !selectedTeamId) {
      setTeamMembers([])
      setRosterAssignments({})
      return
    }
    let active = true
    setLoadingTeamMembers(true)
    listAdminTeamMembers(selectedTeamId, '', 100, 0)
      .then((res) => {
        if (!active) return
        setTeamMembers(res.members || [])
        const existingTeam = (selectedEvent.teams ?? []).find((t) => t.teamId === selectedTeamId)
        const nextMap: Record<string, 'NONE' | 'PRIMARY' | 'BACKUP'> = {}
        for (const m of res.members || []) {
          if (existingTeam?.primaryRoster?.some((pm) => pm.userId === m.userId)) {
            nextMap[m.userId] = 'PRIMARY'
          } else if (existingTeam?.backupRoster?.some((bm) => bm.userId === m.userId)) {
            nextMap[m.userId] = 'BACKUP'
          } else {
            nextMap[m.userId] = 'NONE'
          }
        }
        setRosterAssignments(nextMap)
      })
      .catch(() => {
        if (active) setTeamMembers([])
      })
      .finally(() => {
        if (active) setLoadingTeamMembers(false)
      })
    return () => {
      active = false
    }
  }, [isTeamEvent, selectedTeamId, selectedEvent.teams])

  if (isTeamEvent) {
    const primarySelected = Object.entries(rosterAssignments)
      .filter(([, role]) => role === 'PRIMARY')
      .map(([uid]) => uid)
    const backupSelected = Object.entries(rosterAssignments)
      .filter(([, role]) => role === 'BACKUP')
      .map(([uid]) => uid)

    const maxPrimary = selectedEvent.maxPrimaryRosterSize
    const maxBackup = selectedEvent.maxBackupRosterSize
    const teams = selectedEvent.teams ?? []

    const onSaveTeamRoster = async (e: React.FormEvent) => {
      e.preventDefault()
      if (!selectedTeamId || !handleUpsertEventTeamRoster) return
      setSavingTeamRoster(true)
      try {
        const ok = await handleUpsertEventTeamRoster(selectedTeamId, primarySelected, backupSelected)
        if (ok) {
          setSelectedTeamId('')
          setSelectedTeamObj(null)
          setTeamMembers([])
          setRosterAssignments({})
        }
      } finally {
        setSavingTeamRoster(false)
      }
    }

    return (
      <div style={{ paddingTop: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <Flash variant="default">
          <div style={{ fontSize: '13px', lineHeight: 1.5 }}>
            <strong>Team-Based Competition Mode</strong>
            <p style={{ margin: '4px 0 0 0' }}>
              Register approved teams and assign their <strong>Primary</strong> and <strong>Backup</strong> rosters.
              Only <strong>PRIMARY</strong> roster members can be placed into race lineups; use the 1-click{' '}
              <strong>Sub In</strong> control below to promote or swap a Backup member into the Primary roster.
              {maxPrimary !== null && ` Max Primary per team: ${maxPrimary}.`}
              {maxBackup !== null && ` Max Backup per team: ${maxBackup}.`}
            </p>
          </div>
        </Flash>

        {/* Register / Edit Team Roster Builder */}
        <div className="primer-box" style={{ padding: '14px 16px' }}>
          <form onSubmit={onSaveTeamRoster} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '10px', flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 280px', minWidth: '220px' }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: '12px',
                    fontWeight: 600,
                    marginBottom: '6px',
                    color: 'var(--fgColor-default, #1f2328)',
                  }}
                >
                  Register or Edit Team Roster
                </label>
                <TeamSearchCombobox
                  value={selectedTeamId}
                  onChange={(id, team) => {
                    setSelectedTeamId(id)
                    setSelectedTeamObj(team)
                  }}
                />
              </div>
              {selectedTeamId && (
                <Button
                  type="submit"
                  variant="primary"
                  leadingVisual={PersonAddIcon}
                  disabled={savingTeamRoster || primarySelected.length === 0}
                >
                  {savingTeamRoster ? 'Saving Roster...' : 'Save Team Roster'}
                </Button>
              )}
            </div>

            {selectedTeamId && (
              <div style={{ borderTop: '1px solid var(--borderColor-muted, #d8dee4)', paddingTop: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 600 }}>
                    Assign Roster for {selectedTeamObj?.name ?? selectedTeamId}
                  </span>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <Label variant={maxPrimary !== null && primarySelected.length > maxPrimary ? 'danger' : 'accent'}>
                      Primary: {primarySelected.length}{maxPrimary !== null ? ` / ${maxPrimary}` : ''}
                    </Label>
                    <Label variant={maxBackup !== null && backupSelected.length > maxBackup ? 'danger' : 'secondary'}>
                      Backup: {backupSelected.length}{maxBackup !== null ? ` / ${maxBackup}` : ''}
                    </Label>
                  </div>
                </div>

                {loadingTeamMembers ? (
                  <p style={{ margin: 0, fontSize: '12px', color: 'var(--fgColor-muted, #636c76)' }}>
                    Loading team members...
                  </p>
                ) : teamMembers.length === 0 ? (
                  <p style={{ margin: 0, fontSize: '12px', color: 'var(--fgColor-muted, #636c76)' }}>
                    This team has no members yet.
                  </p>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '8px' }}>
                    {teamMembers.map((tm) => {
                      const role = rosterAssignments[tm.userId] ?? 'NONE'
                      return (
                        <div
                          key={tm.userId}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '8px',
                            padding: '6px 10px',
                            border: '1px solid var(--borderColor-default, #d0d7de)',
                            borderRadius: '6px',
                            backgroundColor: 'var(--bgColor-muted, #f6f8fa)',
                          }}
                        >
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: '12px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {tm.name}
                            </div>
                            {tm.slug && (
                              <div style={{ fontSize: '11px', color: 'var(--fgColor-muted, #636c76)' }}>@{tm.slug}</div>
                            )}
                          </div>
                          <select
                            aria-label={`Roster role for ${tm.name}`}
                            value={role}
                            onChange={(e) =>
                              setRosterAssignments((prev) => ({
                                ...prev,
                                [tm.userId]: e.target.value as 'NONE' | 'PRIMARY' | 'BACKUP',
                              }))
                            }
                            style={{
                              padding: '3px 6px',
                              fontSize: '12px',
                              borderRadius: '6px',
                              border: '1px solid var(--borderColor-default, #d0d7de)',
                              backgroundColor: 'var(--bgColor-default, #ffffff)',
                            }}
                          >
                            <option value="NONE">Not Entered</option>
                            <option value="PRIMARY">Primary</option>
                            <option value="BACKUP">Backup</option>
                          </select>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </form>
        </div>

        {/* Registered Teams & Rosters */}
        <div className="primer-box">
          <div className="primer-box-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>
              Registered Teams ({teams.length}
              {selectedEvent.participantLimit !== null ? ` / ${selectedEvent.participantLimit}` : ''})
            </h3>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--fgColor-muted, #636c76)', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={replaceUpcoming}
                onChange={(e) => setReplaceUpcoming(e.target.checked)}
              />
              Replace outgoing primary in unstarted races on swap
            </label>
          </div>

          {teams.length === 0 ? (
            <p style={{ margin: 0, padding: '24px 16px', textAlign: 'center', fontSize: '13px', color: 'var(--fgColor-muted, #636c76)' }}>
              No teams are currently registered for this event.
            </p>
          ) : (
            <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {teams.map((team) => {
                const primary = team.primaryRoster ?? []
                const backup = team.backupRoster ?? []
                const primaryFull = maxPrimary !== null && primary.length >= maxPrimary

                return (
                  <div
                    key={team.teamId}
                    style={{
                      border: '1px solid var(--borderColor-default, #d0d7de)',
                      borderRadius: '6px',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        padding: '10px 14px',
                        backgroundColor: 'var(--bgColor-muted, #f6f8fa)',
                        borderBottom: '1px solid var(--borderColor-default, #d0d7de)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '8px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <strong style={{ fontSize: '14px' }}>{team.name}</strong>
                        <code style={{ fontSize: '11px', color: 'var(--fgColor-muted, #636c76)' }}>@{team.slug}</code>
                        <Label variant="accent" size="small">
                          Primary: {primary.length}{maxPrimary !== null ? ` / ${maxPrimary}` : ''}
                        </Label>
                        <Label variant="secondary" size="small">
                          Backup: {backup.length}{maxBackup !== null ? ` / ${maxBackup}` : ''}
                        </Label>
                      </div>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <Button
                          size="small"
                          onClick={() => {
                            setSelectedTeamId(team.teamId)
                            setSelectedTeamObj({ id: team.teamId, name: team.name, slug: team.slug } as any)
                          }}
                        >
                          Edit Roster
                        </Button>
                        {handleRemoveEventTeam && (
                          <Button
                            size="small"
                            variant="danger"
                            leadingVisual={TrashIcon}
                            onClick={() => void handleRemoveEventTeam(team.teamId)}
                          >
                            Remove Team
                          </Button>
                        )}
                      </div>
                    </div>

                    <div style={{ padding: '12px 14px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
                      {/* Primary Roster */}
                      <div>
                        <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--fgColor-accent, #0969da)', marginBottom: '6px' }}>
                          Primary Roster (Race Eligible)
                        </div>
                        {primary.length === 0 ? (
                          <p style={{ margin: 0, fontSize: '12px', color: 'var(--fgColor-muted, #636c76)' }}>None</p>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {primary.map((m) => (
                              <div
                                key={m.userId}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  padding: '6px 10px',
                                  borderRadius: '6px',
                                  border: '1px solid var(--borderColor-muted, #d8dee4)',
                                  fontSize: '12px',
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <UserLink userId={m.userId} name={m.name} />
                                  <Label variant="secondary" size="small">
                                    {!m.classTier || m.classTier === 'PRE_OP' || m.classTier === 'OP' ? 'Open' : m.classTier}
                                  </Label>
                                </div>
                                <Label variant="accent" size="small">PRIMARY</Label>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Backup Roster */}
                      <div>
                        <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--fgColor-muted, #636c76)', marginBottom: '6px' }}>
                          Backup Roster (Substitutes)
                        </div>
                        {backup.length === 0 ? (
                          <p style={{ margin: 0, fontSize: '12px', color: 'var(--fgColor-muted, #636c76)' }}>No backup members assigned</p>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {backup.map((m) => {
                              const chosenOutgoing = swapTargets[m.userId] ?? (primaryFull && primary[0] ? primary[0].userId : '')
                              return (
                                <div
                                  key={m.userId}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    gap: '8px',
                                    flexWrap: 'wrap',
                                    padding: '6px 10px',
                                    borderRadius: '6px',
                                    border: '1px solid var(--borderColor-muted, #d8dee4)',
                                    fontSize: '12px',
                                  }}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <UserLink userId={m.userId} name={m.name} />
                                    <Label variant="secondary" size="small">BACKUP</Label>
                                  </div>
                                  {handleSubstituteTeamMember && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                      <select
                                        aria-label={`Swap target for ${m.name}`}
                                        value={chosenOutgoing}
                                        onChange={(e) =>
                                          setSwapTargets((prev) => ({ ...prev, [m.userId]: e.target.value }))
                                        }
                                        style={{
                                          padding: '2px 6px',
                                          fontSize: '11px',
                                          borderRadius: '4px',
                                          border: '1px solid var(--borderColor-default, #d0d7de)',
                                          backgroundColor: 'var(--bgColor-default, #ffffff)',
                                        }}
                                      >
                                        {!primaryFull && <option value="">Promote directly</option>}
                                        {primary.map((pm) => (
                                          <option key={pm.userId} value={pm.userId}>
                                            Swap with {pm.name}
                                          </option>
                                        ))}
                                      </select>
                                      <Button
                                        size="small"
                                        leadingVisual={ArrowSwitchIcon}
                                        onClick={() =>
                                          void handleSubstituteTeamMember(
                                            team.teamId,
                                            m.userId,
                                            chosenOutgoing || null,
                                            replaceUpcoming,
                                          )
                                        }
                                      >
                                        Sub In
                                      </Button>
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div style={{ paddingTop: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {isGranular ? (
        <Flash variant="default">
          <div style={{ fontSize: '13px', lineHeight: 1.5 }}>
            <strong>Granular Per-Race Participation Enabled</strong>
            <p style={{ margin: '4px 0 0 0' }}>
              In granular events, competitors enroll directly into individual races on the{' '}
              <strong>Races &amp; Tracks</strong> tab. Removing a participant below will un-enroll them from all registered races and remove them from the event.
            </p>
          </div>
        </Flash>
      ) : (
        <div className="primer-box" style={{ padding: '14px 16px' }}>
          <form
            onSubmit={handleAddMember}
            style={{ display: 'flex', alignItems: 'flex-end', gap: '10px', flexWrap: 'wrap' }}
          >
            <div style={{ flex: '1 1 280px', minWidth: '200px' }}>
              <label
                htmlFor="new-member-input"
                style={{
                  display: 'block',
                  fontSize: '12px',
                  fontWeight: 600,
                  marginBottom: '6px',
                  color: 'var(--fgColor-default, #1f2328)',
                }}
              >
                Register Competitor
              </label>
              <UserSearchCombobox
                value={newMemberUserId}
                onChange={(val) => setNewMemberUserId(val)}
              />
            </div>
            <Button type="submit" variant="primary" leadingVisual={PersonAddIcon} disabled={!newMemberUserId}>
              Register Member
            </Button>
          </form>
        </div>
      )}

      <div className="primer-box">
        <div className="primer-box-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>
            Registered Participants ({selectedEvent.members.length})
          </h3>
        </div>

        {selectedEvent.members.length === 0 ? (
          <p style={{ margin: 0, padding: '24px 16px', textAlign: 'center', fontSize: '13px', color: 'var(--fgColor-muted, #636c76)' }}>
            No participants are currently registered for this competition.
          </p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="primer-table" style={{ minWidth: '640px' }}>
              <thead>
                <tr>
                  <th scope="col" style={{ width: '24%' }}>Competitor Name</th>
                  <th scope="col" style={{ width: '22%' }}>User ID</th>
                  <th scope="col" style={{ width: '110px' }}>Skill Tier</th>
                  {isGranular && <th scope="col">Registered Races</th>}
                  <th scope="col" style={{ width: '100px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {selectedEvent.members.map((member) => {
                  const registeredRaces = isGranular
                    ? (selectedEvent.raceEvents ?? []).filter((r) =>
                        (r.members ?? []).some((rm) => rm.userId === member.userId),
                      )
                    : []

                  return (
                    <tr key={member.userId}>
                      <td style={{ fontWeight: 600 }}>
                        <UserLink userId={member.userId} name={member.name} />
                      </td>
                      <td>
                        <code style={{ fontSize: '12px', color: 'var(--fgColor-muted, #636c76)' }}>
                          {member.userId}
                        </code>
                      </td>
                      <td>
                        <Label variant="secondary" size="small">
                          {!member.classTier || member.classTier === 'PRE_OP' || member.classTier === 'OP'
                            ? 'None'
                            : member.classTier}
                        </Label>
                      </td>
                      {isGranular && (
                        <td>
                          {registeredRaces.length === 0 ? (
                            <span style={{ fontSize: '12px', color: 'var(--fgColor-muted, #636c76)' }}>None</span>
                          ) : (
                            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', maxHeight: '72px', overflowY: 'auto' }}>
                              {registeredRaces.map((r) => (
                                <Label key={r.id} variant="accent" size="small">
                                  #{r.sequence} {r.name}
                                </Label>
                              ))}
                            </div>
                          )}
                        </td>
                      )}
                      <td style={{ textAlign: 'right' }}>
                        <Button
                          type="button"
                          size="small"
                          variant="danger"
                          leadingVisual={TrashIcon}
                          onClick={() => void handleRemoveMember(member.userId)}
                        >
                          Remove
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

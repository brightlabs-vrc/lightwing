import { Button, Flash, Label } from '@primer/react'
import { PersonAddIcon, TrashIcon } from '@primer/octicons-react'
import type { eventmanager } from '../lib/client'
import { UserSearchCombobox } from './UserSearchCombobox'
import { UserLink } from './UserLink'

interface EventMembersTabProps {
  selectedEvent: eventmanager.EventDetail
  newMemberUserId: string
  setNewMemberUserId: (id: string) => void
  handleAddMember: (evt: React.FormEvent) => void
  handleRemoveMember: (userId: string) => void
}

export function EventMembersTab({
  selectedEvent,
  newMemberUserId,
  setNewMemberUserId,
  handleAddMember,
  handleRemoveMember,
}: EventMembersTabProps) {
  const isGranular = selectedEvent.granularParticipation

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

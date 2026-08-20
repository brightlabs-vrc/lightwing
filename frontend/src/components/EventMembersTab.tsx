'use client'
import type { eventmanager } from '../lib/client'
import { UserSearchCombobox } from './UserSearchCombobox'
import { UserLink } from './UserLink'
import { Heading, Text, Button, Label, FormControl } from '@primer/react'

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
  return (
    <div style={{ paddingTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Add Member Quick Form */}
      <div style={{
        backgroundColor: 'var(--color-canvas-subtle)',
        border: '1px solid var(--color-border-default)',
        borderRadius: '6px',
        padding: '1.5rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem'
      }}>
        <form onSubmit={handleAddMember} style={{ display: 'flex', alignItems: 'flex-end', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ flexGrow: 1, minWidth: '240px' }}>
            <FormControl>
              <FormControl.Label style={{ fontWeight: 'bold' }}>Register Competitor</FormControl.Label>
              <UserSearchCombobox
                value={newMemberUserId}
                onChange={(val) => setNewMemberUserId(val)}
              />
            </FormControl>
          </div>
          <Button type="submit" variant="primary">
            Register Member
          </Button>
        </form>
        <span style={{ fontSize: '12px', color: 'var(--color-fg-muted)' }}>
          💡 For mock testing, you can input "mock-user-1", "mock-user-2", "mock-user-3" or other valid IDs.
        </span>
      </div>

      {/* List Members */}
      <Heading as="h3" style={{ fontSize: '18px', margin: 0 }}>Registered Participants</Heading>
      {selectedEvent.members.length === 0 ? (
        <span style={{ fontSize: '14px', color: 'var(--color-fg-muted)' }}>No participants are currently registered for this competition.</span>
      ) : (
        <div style={{ overflowX: 'auto', border: '1px solid var(--color-border-default)', borderRadius: '6px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
            <thead>
              <tr style={{ background: 'var(--color-canvas-subtle)', borderBottom: '1px solid var(--color-border-default)' }}>
                <th style={{ padding: '12px', fontWeight: 'bold' }}>Competitor Name</th>
                <th style={{ padding: '12px', fontWeight: 'bold' }}>User ID</th>
                <th style={{ padding: '12px', fontWeight: 'bold' }}>Skill Tier</th>
                <th style={{ padding: '12px', fontWeight: 'bold', width: '80px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {selectedEvent.members.map((member) => (
                <tr key={member.userId} style={{ borderBottom: '1px solid var(--color-border-default)' }}>
                  <td style={{ padding: '12px', fontWeight: 'bold' }}><UserLink userId={member.userId} name={member.name} /></td>
                  <td style={{ padding: '12px' }}><code style={{ fontSize: '12px' }}>{member.userId}</code></td>
                  <td style={{ padding: '12px' }}>
                    <Label variant="default">
                      {!member.classTier || member.classTier === 'PRE_OP' || member.classTier === 'OP' ? 'None' : member.classTier}
                    </Label>
                  </td>
                  <td style={{ padding: '12px' }}>
                    <Button
                      variant="danger"
                      size="small"
                      onClick={() => void handleRemoveMember(member.userId)}
                    >
                      Remove
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

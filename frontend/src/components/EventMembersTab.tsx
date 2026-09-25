import type { eventmanager } from '../lib/client'
import styles from './EventMembersTab.module.css'

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
    <div className="slds-tabs_default__content slds-show slds-p-vertical_medium" style={{ paddingTop: '1.5rem' }}>
      {/* Add Member Quick Form / Banner */}
      {isGranular ? (
        <div className="slds-box slds-m-bottom_medium" style={{ background: '#f0f9ff', border: '1px solid #bae6fd', color: '#0369a1', padding: '12px 16px', borderRadius: '4px' }}>
          <strong style={{ display: 'block', marginBottom: '4px' }}>Granular Per-Race Participation Enabled</strong>
          <p style={{ margin: 0, fontSize: '12px', lineHeight: '1.5' }}>
            In granular events, competitors enroll directly into individual races on the <strong>Races &amp; Tracks</strong> tab. Removing a participant below will un-enroll them from all registered races and remove them from the event.
          </p>
        </div>
      ) : (
        <div className={styles.formBox}>
          <form onSubmit={handleAddMember} className={styles.formGrid}>
            <div className={`slds-form-element ${styles.formElement}`}>
              <label className="slds-form-element__label font-bold text-slate-700" style={{ fontWeight: 'bold' }} htmlFor="new-member-input">
                Register Competitor
              </label>
              <div className="slds-form-element__control">
                <UserSearchCombobox
                  value={newMemberUserId}
                  onChange={(val) => setNewMemberUserId(val)}
                />
              </div>
            </div>
            <button
              type="submit"
              className="slds-button slds-button_brand"
              style={{ padding: '6px 16px', height: '36px' }}
            >
              Register Member
            </button>
          </form>
          <p className={styles.helperText}>
            💡 For mock testing, you can input "mock-user-1", "mock-user-2", "mock-user-3" or other valid IDs.
          </p>
        </div>
      )}

      {/* List Members */}
      <h3 className={styles.headerTitle}>Registered Participants</h3>
      {selectedEvent.members.length === 0 ? (
        <p className="slds-text-body_small text-slate-500">No participants are currently registered for this competition.</p>
      ) : (
        <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '4px' }}>
          <table className={`slds-table slds-table_cell-buffer slds-table_bordered ${styles.membersTable}`} style={{ width: '100%', tableLayout: 'fixed' }}>
            <thead>
              <tr className="slds-line-height_reset" style={{ background: '#f3f2f1' }}>
                <th scope="col" style={{ fontWeight: 'bold', width: '22%', minWidth: '160px' }}>
                  <div className="slds-truncate" title="Competitor Name">Competitor Name</div>
                </th>
                <th scope="col" style={{ fontWeight: 'bold', width: '20%', minWidth: '140px' }}>
                  <div className="slds-truncate" title="User ID">User ID</div>
                </th>
                <th scope="col" style={{ fontWeight: 'bold', width: '110px' }}>
                  <div className="slds-truncate" title="Skill Tier">Skill Tier</div>
                </th>
                {isGranular && (
                  <th scope="col" style={{ fontWeight: 'bold', minWidth: '240px' }}>
                    <div className="slds-truncate" title="Registered Races">Registered Races</div>
                  </th>
                )}
                <th scope="col" style={{ fontWeight: 'bold', width: '90px', textAlign: 'right' }}>
                  <div className="slds-truncate" title="Actions">Actions</div>
                </th>
              </tr>
            </thead>
            <tbody>
              {selectedEvent.members.map((member) => {
                const registeredRaces = isGranular
                  ? (selectedEvent.raceEvents ?? []).filter((r) =>
                      (r.members ?? []).some((rm) => rm.userId === member.userId)
                    )
                  : []

                return (
                  <tr key={member.userId} className="slds-hint-parent">
                    <td>
                      <div className="slds-truncate" title={member.name}>
                        <UserLink userId={member.userId} name={member.name} />
                      </div>
                    </td>
                    <td>
                      <div className="slds-truncate" title={member.userId}>
                        <code className="text-xs">{member.userId}</code>
                      </div>
                    </td>
                    <td>
                      <span className="slds-badge slds-theme_light" style={{ padding: '1px 6px', fontSize: '10px' }}>
                        {!member.classTier || member.classTier === 'PRE_OP' || member.classTier === 'OP' ? 'None' : member.classTier}
                      </span>
                    </td>
                    {isGranular && (
                      <td>
                        {registeredRaces.length === 0 ? (
                          <span className="slds-badge slds-theme_light" style={{ padding: '1px 6px', fontSize: '10px', color: '#64748b' }}>
                            None
                          </span>
                        ) : (
                          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', maxHeight: '80px', overflowY: 'auto' }}>
                            {registeredRaces.map((r) => (
                              <span key={r.id} className="slds-badge slds-theme_light" title={`#${r.sequence} ${r.name}`} style={{ padding: '1px 6px', fontSize: '10px', background: '#f1f5f9', border: '1px solid #cbd5e1', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', maxWidth: '220px' }}>
                                #{r.sequence} {r.name}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                    )}
                    <td>
                      <button
                        type="button"
                        onClick={() => void handleRemoveMember(member.userId)}
                        className={styles.btnDestructive}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

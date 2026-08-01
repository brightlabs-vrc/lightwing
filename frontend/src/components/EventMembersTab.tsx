import type { eventmanager } from '../lib/client'
import styles from './EventMembersTab.module.css'

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
    <div className="slds-tabs_default__content slds-show slds-p-vertical_medium" style={{ paddingTop: '1.5rem' }}>
      {/* Add Member Quick Form */}
      <div className={styles.formBox}>
        <form onSubmit={handleAddMember} className={styles.formGrid}>
          <div className={`slds-form-element ${styles.formElement}`}>
            <label className="slds-form-element__label font-bold text-slate-700" style={{ fontWeight: 'bold' }} htmlFor="new-member-input">
              Register Competitor (Enter User ID)
            </label>
            <div className="slds-form-element__control">
              <input
                id="new-member-input"
                type="text"
                placeholder="e.g. user_abc123"
                value={newMemberUserId}
                onChange={(e) => setNewMemberUserId(e.target.value)}
                className={`slds-input ${styles.inputControl}`}
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

      {/* List Members */}
      <h3 className={styles.headerTitle}>Registered Participants</h3>
      {selectedEvent.members.length === 0 ? (
        <p className="slds-text-body_small text-slate-500">No participants are currently registered for this competition.</p>
      ) : (
        <table className={`slds-table slds-table_cell-buffer slds-table_bordered ${styles.membersTable}`}>
          <thead>
            <tr className="slds-line-height_reset" style={{ background: '#f3f2f1' }}>
              <th scope="col" style={{ fontWeight: 'bold' }}><div className="slds-truncate">Competitor Name</div></th>
              <th scope="col" style={{ fontWeight: 'bold' }}><div className="slds-truncate">User ID</div></th>
              <th scope="col" style={{ fontWeight: 'bold' }}><div className="slds-truncate">Skill Tier</div></th>
              <th scope="col" style={{ fontWeight: 'bold', width: '80px' }}><div className="slds-truncate">Actions</div></th>
            </tr>
          </thead>
          <tbody>
            {selectedEvent.members.map((member) => (
              <tr key={member.userId} className="slds-hint-parent">
                <td><span className="font-semibold text-slate-800">{member.name}</span></td>
                <td><code className="text-xs">{member.userId}</code></td>
                <td>
                  <span className="slds-badge slds-theme_light" style={{ padding: '1px 6px', fontSize: '10px' }}>
                    {member.classTier ?? 'PRE_OP'}
                  </span>
                </td>
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
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

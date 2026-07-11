import { Link, createFileRoute } from '@tanstack/react-router'
import { requireSiteAdmin } from '../../../lib/auth-guard'
import { AdminLayout } from '../-AdminLayout'
import { useEventDetail } from '../../../hooks/useEventDetail'
import { isRaceNotStarted, isRaceOngoing } from '../../../lib/raceStatus'
import { AlertBanner } from '../../../components/AlertBanner'
import { LoadingBox } from '../../../components/LoadingBox'
import { StandingsEditor } from '../../../components/StandingsEditor'
import type { eventmanager } from '../../../lib/client'

export const Route = createFileRoute('/admin/events/$eventId')({
  beforeLoad: async ({ location }) => {
    await requireSiteAdmin(location)
  },
  component: AdminEventDetailPage,
})

function AdminEventDetailPage() {
  const { eventId } = Route.useParams()
  const {
    STATUS_OPTIONS,
    CLASS_TIER_OPTIONS,
    selectedEvent,
    activeTab,
    setActiveTab,
    races,
    selectedRaceId,
    selectedRace,
    newMemberUserId,
    setNewMemberUserId,
    newRaceForm,
    setNewRaceForm,
    loadingEventDetail,
    eventStatusSaving,
    globalError,
    globalSuccess,
    derivedStates,
    changeSummary,
    loadingResults,
    savingBatch,
    handleUpdateEventStatus,
    handleAddMember,
    handleRemoveMember,
    handleCreateRace,
    handleStartRace,
    handleEndRace,
    handleDeleteRace,
    handleSelectRace,
    handleResultChange,
    togglePendingDeletion,
    handleUndoRow,
    resetStandingsDraft,
    handleInferFinishTimes,
    handleCancelStandingsEdit,
    handleUnifiedSave,
  } = useEventDetail(eventId)

  return (
    <AdminLayout
      title="Event & Race Operations"
      subtitle="Manage event lifecycle, register competitors, construct race tracks, and perform dynamic batch or in-place results entry."
      actions={
        <Link
          to="/admin/events"
          className="slds-button slds-button_neutral"
          style={{ padding: '4px 12px', fontSize: '12px' }}
        >
          ← Back to Events
        </Link>
      }
    >
      {globalError && (
        <AlertBanner variant="error">{globalError}</AlertBanner>
      )}
      {globalSuccess && (
        <AlertBanner variant="success">{globalSuccess}</AlertBanner>
      )}

      {loadingEventDetail ? (
        <LoadingBox message={`Loading details for ${selectedEvent?.name ?? eventId}...`} />
      ) : selectedEvent ? (
        <div className="slds-box bg-white" style={{ background: '#ffffff', borderRadius: '4px', border: '1px solid #dddbda', padding: '1.5rem' }}>
          <div className="slds-grid slds-grid_align-spread slds-m-bottom_large" style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #dddbda', paddingBottom: '1rem' }}>
            <div>
              <h2 className="slds-text-heading_medium font-bold text-slate-900" style={{ fontSize: '1.35rem', fontWeight: 'bold' }}>{selectedEvent.name}</h2>
              <p className="slds-text-body_small text-slate-500">ID: {selectedEvent.id}</p>
            </div>

            {/* Status controller */}
            <div className="slds-form-element" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <label className="slds-form-element__label font-bold text-slate-700" style={{ fontWeight: 'bold', margin: 0 }}>Lifecycle Status:</label>
              <div className="slds-form-element__control">
                <select
                  disabled={eventStatusSaving}
                  value={selectedEvent.status}
                  onChange={(e) => void handleUpdateEventStatus(e.target.value as eventmanager.EventStatus)}
                  className="slds-select"
                  style={{ minWidth: '130px', padding: '4px 28px 4px 12px', border: '1px solid #dddbda', borderRadius: '4px' }}
                >
                  {STATUS_OPTIONS.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* SLDS Tabs Secondary Context Header */}
          <div className="slds-tabs_default slds-m-bottom_large">
            <ul className="slds-tabs_default__nav" role="tablist" style={{ display: 'flex', borderBottom: '1px solid #dddbda', listStyle: 'none', margin: 0, padding: 0 }}>
              <li className={`slds-tabs_default__item ${activeTab === 'details' ? 'slds-is-active' : ''}`} role="presentation" style={{ borderBottom: activeTab === 'details' ? '3px solid #0176d3' : 'none' }}>
                <button
                  className="slds-tabs_default__link"
                  type="button"
                  onClick={() => setActiveTab('details')}
                  style={{ border: 'none', background: 'transparent', padding: '12px 16px', cursor: 'pointer', fontWeight: activeTab === 'details' ? 'bold' : 'normal', color: activeTab === 'details' ? '#0176d3' : '#180505' }}
                >
                  Event Summary
                </button>
              </li>
              <li className={`slds-tabs_default__item ${activeTab === 'members' ? 'slds-is-active' : ''}`} role="presentation" style={{ borderBottom: activeTab === 'members' ? '3px solid #0176d3' : 'none' }}>
                <button
                  className="slds-tabs_default__link"
                  type="button"
                  onClick={() => setActiveTab('members')}
                  style={{ border: 'none', background: 'transparent', padding: '12px 16px', cursor: 'pointer', fontWeight: activeTab === 'members' ? 'bold' : 'normal', color: activeTab === 'members' ? '#0176d3' : '#180505' }}
                >
                  Event Members ({selectedEvent.members.length})
                </button>
              </li>
              <li className={`slds-tabs_default__item ${activeTab === 'races' ? 'slds-is-active' : ''}`} role="presentation" style={{ borderBottom: activeTab === 'races' ? '3px solid #0176d3' : 'none' }}>
                <button
                  className="slds-tabs_default__link"
                  type="button"
                  onClick={() => setActiveTab('races')}
                  style={{ border: 'none', background: 'transparent', padding: '12px 16px', cursor: 'pointer', fontWeight: activeTab === 'races' ? 'bold' : 'normal', color: activeTab === 'races' ? '#0176d3' : '#180505' }}
                >
                  Races & Tracks ({races.length})
                </button>
              </li>
            </ul>

            {/* Tab 1: Summary Info */}
            {activeTab === 'details' && (
              <div className="slds-tabs_default__content slds-show slds-p-vertical_medium" style={{ paddingTop: '1.5rem' }}>
                <div className="slds-grid slds-wrap slds-gutters">
                  <div className="slds-col slds-size_1-of-1 slds-medium-size_1-of-2 slds-m-bottom_medium">
                    <p className="slds-text-title_caps text-slate-500 font-bold" style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 'bold' }}>Description</p>
                    <p className="slds-text-body_regular text-slate-800 slds-m-top_xx-small">
                      {selectedEvent.description ?? 'No description registered.'}
                    </p>
                  </div>
                  <div className="slds-col slds-size_1-of-1 slds-medium-size_1-of-2 slds-m-bottom_medium">
                    <p className="slds-text-title_caps text-slate-500 font-bold" style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 'bold' }}>Scoring Configuration</p>
                    <p className="slds-text-body_regular text-slate-800 slds-m-top_xx-small">
                      Scoring Mode: <strong>{selectedEvent.scoringTypeLabel}</strong> ({selectedEvent.scoringType === 1 ? 'Points aggregation' : 'Ladder Rating (ELO)'})
                    </p>
                  </div>
                  <div className="slds-col slds-size_1-of-1 slds-medium-size_1-of-2 slds-m-bottom_medium">
                    <p className="slds-text-title_caps text-slate-500 font-bold" style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 'bold' }}>Owner Parameters</p>
                    <p className="slds-text-body_regular text-slate-800 slds-m-top_xx-small">
                      Ownership Type: {selectedEvent.ownerType} <br />
                      ID: {selectedEvent.organizationId ?? selectedEvent.ownerUserId}
                    </p>
                  </div>
                  <div className="slds-col slds-size_1-of-1 slds-medium-size_1-of-2 slds-m-bottom_medium">
                    <p className="slds-text-title_caps text-slate-500 font-bold" style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 'bold' }}>Class restriction</p>
                    <p className="slds-text-body_regular text-slate-800 slds-m-top_xx-small">
                      Tier Restriction: <strong>{selectedEvent.classRestriction ?? 'PRE_OP (Any tier eligibility)'}</strong>
                    </p>
                  </div>
                </div>

                {/* Standings overview aggregates block */}
                <div className="slds-m-top_large">
                  <h3 className="slds-text-heading_small font-bold slds-m-bottom_small text-slate-900" style={{ fontWeight: 'bold', borderBottom: '1px solid #f3f2f1', paddingBottom: '4px' }}>
                    Current Event Overall Leaderboard
                  </h3>
                  {selectedEvent.scoringType === 1 ? (
                    selectedEvent.pointsOverview && selectedEvent.pointsOverview.length > 0 ? (
                      <table className="slds-table slds-table_cell-buffer slds-table_bordered" style={{ border: '1px solid #dddbda' }}>
                        <thead>
                          <tr className="slds-line-height_reset" style={{ background: '#f3f2f1' }}>
                            <th scope="col" style={{ fontWeight: 'bold' }}><div className="slds-truncate">Rank</div></th>
                            <th scope="col" style={{ fontWeight: 'bold' }}><div className="slds-truncate">Name</div></th>
                            <th scope="col" style={{ fontWeight: 'bold' }}><div className="slds-truncate">User ID</div></th>
                            <th scope="col" style={{ fontWeight: 'bold' }}><div className="slds-truncate">Total Points</div></th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedEvent.pointsOverview.map((item, idx) => (
                            <tr key={item.userId} className="slds-hint-parent">
                              <td><strong>{idx + 1}</strong></td>
                              <td><span className="font-semibold text-blue-600">{item.name}</span></td>
                              <td><code className="text-xs">{item.userId}</code></td>
                              <td><strong>{item.points} pts</strong></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <p className="slds-text-body_small text-slate-500">No participants score standings loaded.</p>
                    )
                  ) : (
                    selectedEvent.ladderOverview && selectedEvent.ladderOverview.length > 0 ? (
                      <table className="slds-table slds-table_cell-buffer slds-table_bordered" style={{ border: '1px solid #dddbda' }}>
                        <thead>
                          <tr className="slds-line-height_reset" style={{ background: '#f3f2f1' }}>
                            <th scope="col" style={{ fontWeight: 'bold' }}><div className="slds-truncate">Rank</div></th>
                            <th scope="col" style={{ fontWeight: 'bold' }}><div className="slds-truncate">Name</div></th>
                            <th scope="col" style={{ fontWeight: 'bold' }}><div className="slds-truncate">Rating (ELO)</div></th>
                            <th scope="col" style={{ fontWeight: 'bold' }}><div className="slds-truncate">Wins / Losses</div></th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedEvent.ladderOverview.map((item) => (
                            <tr key={item.userId} className="slds-hint-parent">
                              <td><strong>{item.rank}</strong></td>
                              <td><span className="font-semibold text-blue-600">{item.name}</span></td>
                              <td><strong>{item.elo}</strong></td>
                              <td>{item.wins}W - {item.losses}L</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <p className="slds-text-body_small text-slate-500">No ladder match results computed yet.</p>
                    )
                  )}
                </div>
              </div>
            )}

            {/* Tab 2: Registered Members */}
            {activeTab === 'members' && (
              <div className="slds-tabs_default__content slds-show slds-p-vertical_medium" style={{ paddingTop: '1.5rem' }}>
                {/* Add Member Quick Form */}
                <div className="slds-box slds-m-bottom_large" style={{ background: '#f3f2f1', border: '1px solid #dddbda' }}>
                  <form onSubmit={handleAddMember} className="slds-grid slds-wrap slds-grid_vertical-align-center" style={{ display: 'flex', alignItems: 'flex-end', gap: '12px' }}>
                    <div className="slds-form-element" style={{ flexGrow: 1, minWidth: '240px' }}>
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
                          className="slds-input"
                          style={{ padding: '6px 12px', border: '1px solid #dddbda', borderRadius: '4px', background: '#fff' }}
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
                  <p className="slds-text-body_small text-slate-500 slds-m-top_x-small" style={{ fontSize: '11px', margin: '4px 0 0 0' }}>
                    💡 For mock testing, you can input "mock-user-1", "mock-user-2", "mock-user-3" or other valid IDs.
                  </p>
                </div>

                {/* List Members */}
                <h3 className="slds-text-heading_small font-bold slds-m-bottom_small text-slate-900" style={{ fontWeight: 'bold' }}>Registered Participants</h3>
                {selectedEvent.members.length === 0 ? (
                  <p className="slds-text-body_small text-slate-500">No participants are currently registered for this competition.</p>
                ) : (
                  <table className="slds-table slds-table_cell-buffer slds-table_bordered" style={{ border: '1px solid #dddbda' }}>
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
                              className="slds-button slds-button_destructive"
                              style={{ padding: '1px 8px', fontSize: '11px', background: '#d32f2f', color: '#fff' }}
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
            )}

            {/* Tab 3: Races & Tracks */}
            {activeTab === 'races' && (
              <div className="slds-tabs_default__content slds-show slds-p-vertical_medium" style={{ paddingTop: '1.5rem' }}>
                {/* Race creation block */}
                <details className="slds-m-bottom_large" style={{ border: '1px solid #dddbda', borderRadius: '4px', background: '#f3f2f1' }}>
                  <summary className="font-bold text-slate-800" style={{ cursor: 'pointer', padding: '10px 16px', fontWeight: 'bold' }}>
                    🛠️ Click here to configure a New Race Event
                  </summary>
                  <div style={{ padding: '16px', borderTop: '1px solid #dddbda', background: '#ffffff' }}>
                    <form onSubmit={handleCreateRace} className="slds-grid slds-wrap slds-gutters" style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                      <div className="slds-col slds-size_1-of-1 slds-medium-size_1-2" style={{ flex: '1 1 45%' }}>
                        <div className="slds-form-element">
                          <label className="slds-form-element__label font-bold text-slate-700" style={{ fontWeight: 'bold' }}>Race Name</label>
                          <input
                            type="text"
                            required
                            placeholder="e.g. Kyoto Derby"
                            value={newRaceForm.name}
                            onChange={(e) => setNewRaceForm((c) => ({ ...c, name: e.target.value }))}
                            className="slds-input"
                            style={{ padding: '6px 12px', border: '1px solid #dddbda', borderRadius: '4px' }}
                          />
                        </div>
                      </div>
                      <div className="slds-col slds-size_1-of-1 slds-medium-size_1-4" style={{ flex: '1 1 20%' }}>
                        <div className="slds-form-element">
                          <label className="slds-form-element__label font-bold text-slate-700" style={{ fontWeight: 'bold' }}>Seq Sequence</label>
                          <input
                            type="number"
                            value={newRaceForm.sequence}
                            onChange={(e) => setNewRaceForm((c) => ({ ...c, sequence: Number(e.target.value) || 1 }))}
                            className="slds-input"
                            style={{ padding: '6px 12px', border: '1px solid #dddbda', borderRadius: '4px' }}
                          />
                        </div>
                      </div>
                      <div className="slds-col slds-size_1-of-1 slds-medium-size_1-4" style={{ flex: '1 1 20%' }}>
                        <div className="slds-form-element">
                          <label className="slds-form-element__label font-bold text-slate-700" style={{ fontWeight: 'bold' }}>Distance (Meters)</label>
                          <input
                            type="number"
                            value={newRaceForm.distanceMeters}
                            onChange={(e) => setNewRaceForm((c) => ({ ...c, distanceMeters: Number(e.target.value) || 1200 }))}
                            className="slds-input"
                            style={{ padding: '6px 12px', border: '1px solid #dddbda', borderRadius: '4px' }}
                          />
                        </div>
                      </div>
                      <div className="slds-col slds-size_1-of-1 slds-medium-size_1-3" style={{ flex: '1 1 30%' }}>
                        <div className="slds-form-element">
                          <label className="slds-form-element__label font-bold text-slate-700" style={{ fontWeight: 'bold' }}>Track Type</label>
                          <input
                            type="text"
                            placeholder="e.g. Turf, Dirt"
                            value={newRaceForm.trackType}
                            onChange={(e) => setNewRaceForm((c) => ({ ...c, trackType: e.target.value }))}
                            className="slds-input"
                            style={{ padding: '6px 12px', border: '1px solid #dddbda', borderRadius: '4px' }}
                          />
                        </div>
                      </div>
                      <div className="slds-col slds-size_1-of-1 slds-medium-size_1-3" style={{ flex: '1 1 30%' }}>
                        <div className="slds-form-element">
                          <label className="slds-form-element__label font-bold text-slate-700" style={{ fontWeight: 'bold' }}>Location</label>
                          <input
                            type="text"
                            required
                            placeholder="e.g. Kyoto Racecourse"
                            value={newRaceForm.location}
                            onChange={(e) => setNewRaceForm((c) => ({ ...c, location: e.target.value }))}
                            className="slds-input"
                            style={{ padding: '6px 12px', border: '1px solid #dddbda', borderRadius: '4px' }}
                          />
                        </div>
                      </div>
                      <div className="slds-col slds-size_1-of-1 slds-medium-size_1-3" style={{ flex: '1 1 30%' }}>
                        <div className="slds-form-element">
                          <label className="slds-form-element__label font-bold text-slate-700" style={{ fontWeight: 'bold' }}>Class Restriction</label>
                          <select
                            value={newRaceForm.classRestriction}
                            onChange={(e) => setNewRaceForm((c) => ({ ...c, classRestriction: e.target.value as eventmanager.ClassTier }))}
                            className="slds-select"
                            style={{ padding: '6px 12px', border: '1px solid #dddbda', borderRadius: '4px' }}
                          >
                            {CLASS_TIER_OPTIONS.map((tier) => (
                              <option key={tier} value={tier}>{tier}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div className="slds-col slds-size_1-of-1" style={{ width: '100%', marginTop: '12px' }}>
                        <button type="submit" className="slds-button slds-button_brand">
                          Create Race Event
                        </button>
                      </div>
                    </form>
                  </div>
                </details>

                {/* List Races */}
                <h3 className="slds-text-heading_small font-bold slds-m-bottom_small text-slate-900" style={{ fontWeight: 'bold' }}>Event Races</h3>
                {races.length === 0 ? (
                  <p className="slds-text-body_small text-slate-500">No race tracks have been configured under this event yet.</p>
                ) : (
                  <div className="slds-scrollable_x">
                    <table className="slds-table slds-table_cell-buffer slds-table_bordered" style={{ border: '1px solid #dddbda' }}>
                      <thead>
                        <tr className="slds-line-height_reset" style={{ background: '#f3f2f1' }}>
                          <th scope="col" style={{ fontWeight: 'bold' }}><div className="slds-truncate">Seq</div></th>
                          <th scope="col" style={{ fontWeight: 'bold' }}><div className="slds-truncate">Race Name</div></th>
                          <th scope="col" style={{ fontWeight: 'bold' }}><div className="slds-truncate">Track & Distance</div></th>
                          <th scope="col" style={{ fontWeight: 'bold' }}><div className="slds-truncate">Location</div></th>
                          <th scope="col" style={{ fontWeight: 'bold' }}><div className="slds-truncate">Status / Schedule</div></th>
                          <th scope="col" style={{ fontWeight: 'bold', width: '220px' }}><div className="slds-truncate">Manual Operations</div></th>
                        </tr>
                      </thead>
                      <tbody>
                        {races.map((race) => (
                          <tr
                            key={race.id}
                            className="slds-hint-parent"
                            style={{
                              background: selectedRaceId === race.id ? '#e0f2fe' : 'transparent',
                              borderLeft: selectedRaceId === race.id ? '4px solid #0284c7' : 'none',
                            }}
                          >
                            <td><strong>#{race.sequence}</strong></td>
                            <td><span className="font-bold text-slate-900" style={{ fontWeight: 'bold' }}>{race.name}</span></td>
                            <td>{race.trackType} ({race.distanceMeters}m)</td>
                            <td>{race.location}</td>
                            <td>
                              {isRaceNotStarted(race) ? (
                                <span className="slds-badge slds-theme_light" style={{ padding: '2px 8px', borderRadius: '4px', background: '#e0e0e0', color: '#333' }}>
                                  Not Started
                                </span>
                              ) : isRaceOngoing(race) ? (
                                <span className="slds-badge slds-theme_warning" style={{ padding: '2px 8px', borderRadius: '4px', background: '#ff9800', color: '#fff', animation: 'pulse 2s infinite' }}>
                                  🔴 Ongoing / Live
                                </span>
                              ) : (
                                <span className="slds-badge slds-theme_success" style={{ padding: '2px 8px', borderRadius: '4px', background: '#2e7d32', color: '#fff' }}>
                                  Concluded
                                </span>
                              )}
                              <div className="text-slate-500 slds-m-top_xx-small" style={{ fontSize: '10px' }}>
                                {race.startsAt ? `Started: ${new Date(race.startsAt).toLocaleTimeString()}` : ''} <br />
                                {race.endsAt ? `Ended: ${new Date(race.endsAt).toLocaleTimeString()}` : ''}
                              </div>
                            </td>
                            <td>
                              <div className="slds-grid slds-wrap" style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                {/* Start Race */}
                                {isRaceNotStarted(race) && (
                                  <button
                                    type="button"
                                    onClick={() => void handleStartRace(race.id)}
                                    className="slds-button slds-button_success"
                                    style={{ padding: '2px 8px', fontSize: '11px', background: '#2e7d32', color: '#fff' }}
                                  >
                                    🚀 Start
                                  </button>
                                )}
                                {/* End Race */}
                                {isRaceOngoing(race) && (
                                  <button
                                    type="button"
                                    onClick={() => void handleEndRace(race.id)}
                                    className="slds-button slds-button_destructive"
                                    style={{ padding: '2px 8px', fontSize: '11px', background: '#d32f2f', color: '#fff' }}
                                  >
                                    🏁 End
                                  </button>
                                )}
                                {/* Edit Standings/Results */}
                                <button
                                  type="button"
                                  onClick={() => void handleSelectRace(race)}
                                  className="slds-button slds-button_brand"
                                  style={{ padding: '2px 8px', fontSize: '11px' }}
                                >
                                  🎯 Edit Results
                                </button>
                                {/* Delete */}
                                <button
                                  type="button"
                                  onClick={() => void handleDeleteRace(race.id)}
                                  className="slds-button slds-button_neutral"
                                  style={{ padding: '2px 8px', fontSize: '11px', color: '#d32f2f' }}
                                >
                                  🗑️ Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Results Editor Pane - Dynamic Standings Entry */}
          {selectedRaceId && selectedRace && (
            <StandingsEditor
              raceName={selectedRace.name}
              isRaceOngoing={isRaceOngoing(selectedRace)}
              loadingResults={loadingResults}
              memberCount={selectedEvent.members.length}
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
            />
          )}
        </div>
      ) : (
        <div className="slds-box slds-align_absolute-center bg-white" style={{ background: '#ffffff', borderRadius: '4px', border: '1px solid #dddbda', minHeight: '400px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <div className="slds-text-align_center">
            <span style={{ fontSize: '48px' }}>🏁</span>
            <p className="slds-text-heading_medium font-bold text-slate-700 slds-m-top_medium" style={{ fontWeight: 'bold' }}>
              Event Not Found
            </p>
            <p className="slds-text-body_regular text-slate-500 slds-m-top_xx-small">
              The requested event could not be loaded. It may have been deleted.
            </p>
            <Link
              to="/admin/events"
              className="slds-button slds-button_brand slds-m-top_medium"
              style={{ padding: '6px 16px' }}
            >
              ← Back to Events
            </Link>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}

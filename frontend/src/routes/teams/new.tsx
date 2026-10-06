import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { requireAuth } from '../../lib/auth-guard'
import { AlertBanner } from '../../components/AlertBanner'
import { UserSearchCombobox } from '../../components/UserSearchCombobox'
import { submitOrganizationApplication, submitTeamApplication, listApprovedOrganizations } from '../../lib/admin-api'
import type { teammanager } from '../../lib/client'

export const Route = createFileRoute('/teams/new')({
  beforeLoad: async ({ location }) => {
    await requireAuth(location)
  },
  component: NewTeamWizardPage,
})

function NewTeamWizardPage() {
  const { session } = useAuth()
  const navigate = useNavigate()

  const [step, setStep] = useState<number>(1)
  const [appType, setAppType] = useState<'ORGANIZATION' | 'TEAM' | null>(null)

  // Details
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [logo, setLogo] = useState('')

  // Org fields
  const [discordInvite, setDiscordInvite] = useState('')
  const [vrchatGroupId, setVrchatGroupId] = useState('')
  const [orgRoster, setOrgRoster] = useState<string[]>([])
  const [newOrgMemberId, setNewOrgMemberId] = useState('')

  // Team fields
  const [primaryOrgId, setPrimaryOrgId] = useState('')
  const [secondaryOrgIds, setSecondaryOrgIds] = useState<string[]>([])
  const [approvedOrgs, setApprovedOrgs] = useState<teammanager.LinkedOrganization[]>([])
  const [teamRoster, setTeamRoster] = useState<string[]>([])
  const [newTeamMemberId, setNewTeamMemberId] = useState('')

  const [loadingOrgs, setLoadingOrgs] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submittedSuccess, setSubmittedSuccess] = useState(false)

  // Load approved organizations for Team path
  useEffect(() => {
    async function fetchOrgs() {
      setLoadingOrgs(true)
      try {
        const res = await listApprovedOrganizations()
        setApprovedOrgs(res.organizations || [])

        // Prefer orgs user administrates
        if (session?.user.teams && session.user.teams.length > 0) {
          const adminOrg = session.user.teams.find((t) => t.role === 'administrator')
          if (adminOrg) {
            setPrimaryOrgId(adminOrg.organizationId)
          } else {
            setPrimaryOrgId(session.user.teams[0].organizationId)
          }
        } else if (res.organizations && res.organizations.length > 0) {
          setPrimaryOrgId(res.organizations[0].id)
        }
      } catch (err) {
        // ignore fallback
      } finally {
        setLoadingOrgs(false)
      }
    }
    void fetchOrgs()
  }, [session])

  const token = session?.session.token
  const authHeader = token ? `Bearer ${token}` : ''

  const handleAddOrgRosterMember = (userId: string) => {
    if (!userId) return
    if (userId === session?.user.id) {
      setError('You are automatically included as the primary administrator.')
      return
    }
    if (orgRoster.includes(userId)) {
      setError('User is already in the roster.')
      return
    }
    if (orgRoster.length + 1 >= 3) { // Creator + 2 additional = 3 max
      setError('At most 3 administrators can belong to an organization.')
      return
    }
    setError(null)
    setOrgRoster([...orgRoster, userId])
    setNewOrgMemberId('')
  }

  const handleRemoveOrgRosterMember = (userId: string) => {
    setOrgRoster(orgRoster.filter((id) => id !== userId))
  }

  const handleAddTeamRosterMember = (userId: string) => {
    if (!userId) return
    if (teamRoster.includes(userId)) {
      setError('User is already in the team roster.')
      return
    }
    setError(null)
    setTeamRoster([...teamRoster, userId])
    setNewTeamMemberId('')
  }

  const handleRemoveTeamRosterMember = (userId: string) => {
    setTeamRoster(teamRoster.filter((id) => id !== userId))
  }

  const handleSubmit = async () => {
    setError(null)
    setSubmitting(true)
    try {
      if (appType === 'ORGANIZATION') {
        if (!discordInvite.trim() || !vrchatGroupId.trim()) {
          throw new Error('Discord Invite URL and VRChat Group ID are required.')
        }
        await submitOrganizationApplication(
          {
            name: name.trim(),
            slug: slug.trim() || undefined,
            logo: logo.trim() || undefined,
            discordInvite: discordInvite.trim(),
            vrchatGroupId: vrchatGroupId.trim(),
            initialRoster: orgRoster,
          },
          authHeader,
        )
      } else {
        if (!primaryOrgId) {
          throw new Error('Primary Organization selection is required.')
        }
        await submitTeamApplication(
          {
            name: name.trim(),
            slug: slug.trim() || undefined,
            logo: logo.trim() || undefined,
            primaryOrganizationId: primaryOrgId,
            secondaryOrganizationIds: secondaryOrgIds,
            initialRoster: teamRoster,
          },
          authHeader,
        )
      }
      setSubmittedSuccess(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Application submission failed.')
    } finally {
      setSubmitting(false)
    }
  }

  if (submittedSuccess) {
    return (
      <div className="slds-scope p-6 bg-slate-100 min-h-screen" style={{ padding: '2rem' }}>
        <div className="slds-box bg-white max-w-xl mx-auto slds-p-around_large" style={{ background: '#fff', maxWidth: '36rem', margin: '3rem auto', padding: '2rem', borderRadius: '8px', border: '1px solid #dddbda' }}>
          <div className="slds-text-align_center">
            <span className="slds-icon_container slds-icon-utility-success" style={{ fontSize: '3rem', color: '#2e7d32' }}>
              ✅
            </span>
            <h2 className="slds-text-heading_medium font-bold text-slate-900 slds-m-top_medium" style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>
              Application Submitted!
            </h2>
            <p className="slds-text-body_regular text-slate-600 slds-m-top_small" style={{ color: '#514f4d', fontSize: '0.95rem' }}>
              Your application for <strong>{name}</strong> ({appType}) has been recorded. Administrators will review your submission shortly.
            </p>
            <div className="slds-m-top_large" style={{ marginTop: '1.5rem' }}>
              <button
                type="button"
                onClick={() => navigate({ to: '/' })}
                className="slds-button slds-button_brand"
                style={{ padding: '8px 24px' }}
              >
                Return to Home
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="slds-scope p-6 bg-slate-100 min-h-screen" style={{ padding: '2rem 1rem', background: '#f3f2f1', minHeight: '100vh' }}>
      <div className="max-w-3xl mx-auto bg-white rounded shadow-sm border p-6" style={{ maxWidth: '48rem', margin: '0 auto', background: '#fff', borderRadius: '8px', border: '1px solid #dddbda', padding: '2rem' }}>
        <h1 className="slds-text-heading_large font-bold text-slate-900 slds-m-bottom_medium" style={{ fontSize: '1.75rem', fontWeight: 'bold' }}>
          Application Wizard
        </h1>

        {error && (
          <div className="slds-m-bottom_medium">
            <AlertBanner variant="error">{error}</AlertBanner>
          </div>
        )}

        {/* STEP 1: TYPE SELECTION */}
        {step === 1 && (
          <div>
            <p className="slds-text-body_regular text-slate-600 slds-m-bottom_medium" style={{ color: '#514f4d' }}>
              Select the entity type you wish to register:
            </p>

            <div className="slds-grid slds-wrap slds-gutters" style={{ display: 'flex', gap: '16px' }}>
              <div className="slds-col slds-size_1-of-1 slds-medium-size_1-of-2" style={{ flex: 1 }}>
                <article
                  onClick={() => { setAppType('ORGANIZATION'); setStep(2); }}
                  className={`slds-card slds-card_boundary ${appType === 'ORGANIZATION' ? 'border-blue-600 bg-blue-50' : ''}`}
                  style={{ cursor: 'pointer', padding: '1.5rem', border: appType === 'ORGANIZATION' ? '2px solid #0176d3' : '1px solid #dddbda', borderRadius: '6px', height: '100%' }}
                >
                  <div className="slds-media slds-media_center">
                    <span style={{ fontSize: '2rem', marginRight: '1rem' }}>🏢</span>
                    <div className="slds-media__body">
                      <h2 className="slds-text-heading_small font-bold" style={{ fontWeight: 'bold' }}>New Organization</h2>
                      <p className="slds-text-body_small text-slate-500" style={{ fontSize: '12px', color: '#514f4d' }}>
                        Register an overarching esports organization / league group with staff roster.
                      </p>
                    </div>
                  </div>
                </article>
              </div>

              <div className="slds-col slds-size_1-of-1 slds-medium-size_1-of-2" style={{ flex: 1 }}>
                <article
                  onClick={() => { setAppType('TEAM'); setStep(2); }}
                  className={`slds-card slds-card_boundary ${appType === 'TEAM' ? 'border-blue-600 bg-blue-50' : ''}`}
                  style={{ cursor: 'pointer', padding: '1.5rem', border: appType === 'TEAM' ? '2px solid #0176d3' : '1px solid #dddbda', borderRadius: '6px', height: '100%' }}
                >
                  <div className="slds-media slds-media_center">
                    <span style={{ fontSize: '2rem', marginRight: '1rem' }}>🏁</span>
                    <div className="slds-media__body">
                      <h2 className="slds-text-heading_small font-bold" style={{ fontWeight: 'bold' }}>New Competitive Team</h2>
                      <p className="slds-text-body_small text-slate-500" style={{ fontSize: '12px', color: '#514f4d' }}>
                        Register a competitive racing team operating under an approved organization.
                      </p>
                    </div>
                  </div>
                </article>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: DETAILS */}
        {step === 2 && (
          <div>
            <h2 className="slds-text-heading_medium font-bold slds-m-bottom_small" style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>
              {appType === 'ORGANIZATION' ? 'Organization Details' : 'Team Details'}
            </h2>

            <div className="slds-form slds-form_stacked">
              <div className="slds-form-element slds-m-bottom_medium">
                <label className="slds-form-element__label font-bold" style={{ fontWeight: 'bold' }}>
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder={appType === 'ORGANIZATION' ? 'e.g. Apex Esports Global' : 'e.g. Apex Racing Syndicate'}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="slds-input"
                  style={{ padding: '8px 12px', border: '1px solid #dddbda', borderRadius: '4px', width: '100%' }}
                />
              </div>

              <div className="slds-form-element slds-m-bottom_medium">
                <label className="slds-form-element__label font-bold" style={{ fontWeight: 'bold' }}>Custom Slug (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. apex-esports"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  className="slds-input"
                  style={{ padding: '8px 12px', border: '1px solid #dddbda', borderRadius: '4px', width: '100%' }}
                />
              </div>

              <div className="slds-form-element slds-m-bottom_medium">
                <label className="slds-form-element__label font-bold" style={{ fontWeight: 'bold' }}>Logo Image URL (Optional)</label>
                <input
                  type="url"
                  placeholder="https://example.com/logo.png"
                  value={logo}
                  onChange={(e) => setLogo(e.target.value)}
                  className="slds-input"
                  style={{ padding: '8px 12px', border: '1px solid #dddbda', borderRadius: '4px', width: '100%' }}
                />
              </div>

              {appType === 'ORGANIZATION' && (
                <>
                  <div className="slds-form-element slds-m-bottom_medium">
                    <label className="slds-form-element__label font-bold" style={{ fontWeight: 'bold' }}>
                      Discord Invite URL <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="url"
                      required
                      placeholder="https://discord.gg/yourserver"
                      value={discordInvite}
                      onChange={(e) => setDiscordInvite(e.target.value)}
                      className="slds-input"
                      style={{ padding: '8px 12px', border: '1px solid #dddbda', borderRadius: '4px', width: '100%' }}
                    />
                  </div>

                  <div className="slds-form-element slds-m-bottom_medium">
                    <label className="slds-form-element__label font-bold" style={{ fontWeight: 'bold' }}>
                      VRChat Group ID <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. grp_12345"
                      value={vrchatGroupId}
                      onChange={(e) => setVrchatGroupId(e.target.value)}
                      className="slds-input"
                      style={{ padding: '8px 12px', border: '1px solid #dddbda', borderRadius: '4px', width: '100%' }}
                    />
                  </div>
                </>
              )}
            </div>

            <div className="slds-m-top_large" style={{ display: 'flex', justifyContent: 'space-between' }}>
              <button
                type="button"
                onClick={() => setStep(1)}
                className="slds-button slds-button_neutral"
              >
                &larr; Back
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!name.trim()) {
                    setError('Name is required.')
                    return
                  }
                  if (appType === 'ORGANIZATION' && (!discordInvite.trim() || !vrchatGroupId.trim())) {
                    setError('Discord Invite and VRChat Group ID are required.')
                    return
                  }
                  setError(null)
                  setStep(3)
                }}
                className="slds-button slds-button_brand"
              >
                Next &rarr;
              </button>
            </div>
          </div>
        )}

        {/* STEP 3 (ORGANIZATION): STAFF ROSTER */}
        {step === 3 && appType === 'ORGANIZATION' && (
          <div>
            <h2 className="slds-text-heading_medium font-bold slds-m-bottom_small" style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>
              Preliminary Staff Roster
            </h2>
            <p className="slds-text-body_small text-slate-500 slds-m-bottom_medium" style={{ color: '#514f4d' }}>
              You are automatically set as the primary administrator. You may add up to 2 additional staff administrators (cap of 3 total).
            </p>

            <div className="slds-form-element slds-m-bottom_medium">
              <label className="slds-form-element__label font-bold" style={{ fontWeight: 'bold' }}>Add Staff Administrator</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <div style={{ flex: 1 }}>
                  <UserSearchCombobox
                    value={newOrgMemberId}
                    onChange={setNewOrgMemberId}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => handleAddOrgRosterMember(newOrgMemberId)}
                  className="slds-button slds-button_neutral"
                >
                  Add
                </button>
              </div>
            </div>

            <div className="slds-m-top_medium">
              <h3 className="slds-text-body_regular font-bold slds-m-bottom_x-small" style={{ fontWeight: 'bold' }}>Current Staff Roster:</h3>
              <ul className="slds-has-dividers_bottom-space" style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                <li className="slds-item slds-p-vertical_x-small" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>{session?.user.vrchatUsername ?? session?.user.name} <strong>(Creator / Admin)</strong></span>
                  <span className="slds-badge slds-theme_success" style={{ fontSize: '10px' }}>Primary Admin</span>
                </li>
                {orgRoster.map((uid) => (
                  <li key={uid} className="slds-item slds-p-vertical_x-small" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>User ID: {uid}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveOrgRosterMember(uid)}
                      className="slds-button slds-button_destructive"
                      style={{ fontSize: '11px', padding: '2px 8px' }}
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            <div className="slds-m-top_large" style={{ display: 'flex', justifyContent: 'space-between' }}>
              <button
                type="button"
                onClick={() => setStep(2)}
                className="slds-button slds-button_neutral"
              >
                &larr; Back
              </button>
              <button
                type="button"
                onClick={() => setStep(4)}
                className="slds-button slds-button_brand"
              >
                Review & Submit &rarr;
              </button>
            </div>
          </div>
        )}

        {/* STEP 3 (TEAM): ORGANIZATIONS */}
        {step === 3 && appType === 'TEAM' && (
          <div>
            <h2 className="slds-text-heading_medium font-bold slds-m-bottom_small" style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>
              Organization Affiliation
            </h2>

            <div className="slds-form slds-form_stacked">
              <div className="slds-form-element slds-m-bottom_medium">
                <label className="slds-form-element__label font-bold" style={{ fontWeight: 'bold' }}>
                  Primary Organization <span className="text-red-500">*</span>
                </label>
                {loadingOrgs ? (
                  <p className="text-slate-500">Loading approved organizations...</p>
                ) : (
                  <select
                    value={primaryOrgId}
                    onChange={(e) => setPrimaryOrgId(e.target.value)}
                    className="slds-select"
                    style={{ padding: '8px 12px', border: '1px solid #dddbda', borderRadius: '4px', width: '100%' }}
                  >
                    <option value="">-- Select Primary Organization --</option>
                    {approvedOrgs.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name} ({o.slug})
                      </option>
                    ))}
                  </select>
                )}
                <p className="slds-text-body_small text-slate-500" style={{ fontSize: '11px', marginTop: '4px' }}>
                  You must be an administrator of the primary organization to submit team requests.
                </p>
              </div>

              <div className="slds-form-element slds-m-bottom_medium">
                <label className="slds-form-element__label font-bold" style={{ fontWeight: 'bold' }}>
                  Secondary Organizations ("Also operates in...")
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {approvedOrgs
                    .filter((o) => o.id !== primaryOrgId)
                    .map((o) => (
                      <label key={o.id} className="slds-checkbox" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input
                          type="checkbox"
                          checked={secondaryOrgIds.includes(o.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSecondaryOrgIds([...secondaryOrgIds, o.id])
                            } else {
                              setSecondaryOrgIds(secondaryOrgIds.filter((id) => id !== o.id))
                            }
                          }}
                        />
                        <span>{o.name}</span>
                      </label>
                    ))}
                </div>
              </div>
            </div>

            <div className="slds-m-top_large" style={{ display: 'flex', justifyContent: 'space-between' }}>
              <button
                type="button"
                onClick={() => setStep(2)}
                className="slds-button slds-button_neutral"
              >
                &larr; Back
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!primaryOrgId) {
                    setError('Primary Organization selection is required.')
                    return
                  }
                  setError(null)
                  setStep(4)
                }}
                className="slds-button slds-button_brand"
              >
                Next &rarr;
              </button>
            </div>
          </div>
        )}

        {/* STEP 4 (TEAM): ROSTER */}
        {step === 4 && appType === 'TEAM' && (
          <div>
            <h2 className="slds-text-heading_medium font-bold slds-m-bottom_small" style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>
              Preliminary Team Roster
            </h2>

            <div className="slds-form-element slds-m-bottom_medium">
              <label className="slds-form-element__label font-bold" style={{ fontWeight: 'bold' }}>Add Team Competitor</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <div style={{ flex: 1 }}>
                  <UserSearchCombobox
                    value={newTeamMemberId}
                    onChange={setNewTeamMemberId}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => handleAddTeamRosterMember(newTeamMemberId)}
                  className="slds-button slds-button_neutral"
                >
                  Add
                </button>
              </div>
            </div>

            <div className="slds-m-top_medium">
              <h3 className="slds-text-body_regular font-bold slds-m-bottom_x-small" style={{ fontWeight: 'bold' }}>Team Members:</h3>
              {teamRoster.length === 0 ? (
                <p className="text-slate-500 text-sm">No initial team members added yet.</p>
              ) : (
                <ul className="slds-has-dividers_bottom-space" style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                  {teamRoster.map((uid) => (
                    <li key={uid} className="slds-item slds-p-vertical_x-small" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>User ID: {uid}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveTeamRosterMember(uid)}
                        className="slds-button slds-button_destructive"
                        style={{ fontSize: '11px', padding: '2px 8px' }}
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="slds-m-top_large" style={{ display: 'flex', justifyContent: 'space-between' }}>
              <button
                type="button"
                onClick={() => setStep(3)}
                className="slds-button slds-button_neutral"
              >
                &larr; Back
              </button>
              <button
                type="button"
                onClick={() => setStep(5)}
                className="slds-button slds-button_brand"
              >
                Review & Submit &rarr;
              </button>
            </div>
          </div>
        )}

        {/* REVIEW & SUBMIT STEP */}
        {((step === 4 && appType === 'ORGANIZATION') || (step === 5 && appType === 'TEAM')) && (
          <div>
            <h2 className="slds-text-heading_medium font-bold slds-m-bottom_medium" style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>
              Review Your Application
            </h2>

            <div className="slds-box bg-slate-50 slds-m-bottom_medium" style={{ background: '#f8fafc', padding: '1rem', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
              <p><strong>Type:</strong> {appType}</p>
              <p><strong>Name:</strong> {name}</p>
              {slug && <p><strong>Slug:</strong> {slug}</p>}

              {appType === 'ORGANIZATION' && (
                <>
                  <p><strong>Discord Invite:</strong> {discordInvite}</p>
                  <p><strong>VRChat Group ID:</strong> {vrchatGroupId}</p>
                </>
              )}

              {appType === 'TEAM' && (
                <>
                  <p><strong>Primary Organization ID:</strong> {primaryOrgId}</p>
                  {secondaryOrgIds.length > 0 && <p><strong>Secondary Organizations:</strong> {secondaryOrgIds.join(', ')}</p>}
                </>
              )}
            </div>

            <div className="slds-m-top_large" style={{ display: 'flex', justifyContent: 'space-between' }}>
              <button
                type="button"
                onClick={() => setStep(step - 1)}
                className="slds-button slds-button_neutral"
                disabled={submitting}
              >
                &larr; Back
              </button>
              <button
                type="button"
                onClick={() => void handleSubmit()}
                className="slds-button slds-button_brand"
                disabled={submitting}
              >
                {submitting ? 'Submitting Application...' : 'Confirm & Submit Application'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

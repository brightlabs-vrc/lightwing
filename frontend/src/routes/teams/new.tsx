import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { requireAuth } from '../../lib/auth-guard'
import { UserSearchCombobox } from '../../components/UserSearchCombobox'
import { submitOrganizationApplication, submitTeamApplication, listApprovedOrganizations, listAdminTeams } from '../../lib/admin-api'
import type { teammanager } from '../../lib/client'
import {
  PixelContainer,
  PixelStack,
  PixelCard,
  PixelButton,
  PixelBadge,
  PixelSectionHeader,
  PixelAlert,
  PixelInput,
} from '@pxlkit/ui-kit'
import { ManagementLayout } from './-ManagementLayout'

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
  const [appType, setAppType] = useState<'ORGANIZATION' | 'TEAM' | 'EXISTING_TEAM' | null>(null)

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
  const [userTeams, setUserTeams] = useState<teammanager.TeamListItem[]>([])
  const [selectedExistingTeamId, setSelectedExistingTeamId] = useState('')
  const [teamRoster, setTeamRoster] = useState<string[]>([])
  const [newTeamMemberId, setNewTeamMemberId] = useState('')

  const [loadingOrgs, setLoadingOrgs] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submittedSuccess, setSubmittedSuccess] = useState(false)

  // Load approved organizations and existing teams
  useEffect(() => {
    async function fetchOrgsAndTeams() {
      setLoadingOrgs(true)
      try {
        const [orgsRes, teamsRes] = await Promise.all([
          listApprovedOrganizations(),
          listAdminTeams('', 100, 0).catch(() => ({ teams: [], total: 0 })),
        ])
        setApprovedOrgs(orgsRes.organizations || [])
        setUserTeams(teamsRes.teams || [])

        if (teamsRes.teams && teamsRes.teams.length > 0) {
          setSelectedExistingTeamId(teamsRes.teams[0].id)
        }

        // Prefer orgs user administrates
        if (session?.user.teams && session.user.teams.length > 0) {
          const adminOrg = session.user.teams.find((t) => t.role === 'administrator')
          if (adminOrg) {
            setPrimaryOrgId(adminOrg.organizationId)
          } else {
            setPrimaryOrgId(session.user.teams[0].organizationId)
          }
        } else if (orgsRes.organizations && orgsRes.organizations.length > 0) {
          setPrimaryOrgId(orgsRes.organizations[0].id)
        }
      } catch (err) {
        // ignore fallback
      } finally {
        setLoadingOrgs(false)
      }
    }
    void fetchOrgsAndTeams()
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
      } else if (appType === 'EXISTING_TEAM') {
        const selectedTeam = userTeams.find((t) => t.id === selectedExistingTeamId)
        if (!selectedExistingTeamId || !primaryOrgId) {
          throw new Error('Existing Team and Target Organization selections are required.')
        }
        await submitTeamApplication(
          {
            teamId: selectedExistingTeamId,
            name: selectedTeam?.name || 'Existing Team',
            primaryOrganizationId: primaryOrgId,
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
      <PixelContainer maxWidth="md" padding="md">
        <PixelCard className="text-center py-8">
          <PixelStack gap={4} align="center">
            <span className="text-4xl">✅</span>
            <h2 className="text-xl font-pixel text-retro-text tracking-wide font-bold">
              APPLICATION SUBMITTED!
            </h2>
            <p className="text-sm font-sans text-retro-muted max-w-md">
              Your application for <strong>{appType === 'EXISTING_TEAM' ? userTeams.find((t) => t.id === selectedExistingTeamId)?.name || 'Team' : name}</strong> ({appType}) has been recorded. Administrators will review your submission shortly.
            </p>
            <PixelButton
              variant="solid"
              tone="purple"
              onClick={() => navigate({ to: '/' })}
            >
              RETURN HOME
            </PixelButton>
          </PixelStack>
        </PixelCard>
      </PixelContainer>
    )
  }

  return (
    <ManagementLayout>
      <PixelContainer maxWidth="md" padding="md">
        <PixelSectionHeader
          title="APPLICATION WIZARD"
          titleTone="purple"
          size="lg"
          className="mb-6"
        />

        <PixelCard className="bg-retro-surface">
          <PixelStack gap={6}>
            {error && <PixelAlert tone="red" message={error} />}

          {/* STEP 1: TYPE SELECTION */}
          {step === 1 && (
            <PixelStack gap={4}>
              <p className="text-sm font-sans text-retro-muted font-semibold">
                Select the entity type you wish to register:
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div
                  onClick={() => { setAppType('ORGANIZATION'); setStep(2); }}
                  className={`p-4 rounded border-2 cursor-pointer transition-all ${
                    appType === 'ORGANIZATION'
                      ? 'border-retro-primary bg-retro-primary/10'
                      : 'border-retro-border bg-retro-bg hover:border-retro-primary/50'
                  }`}
                >
                  <PixelStack gap={2}>
                    <span className="text-3xl">🏢</span>
                    <h2 className="font-pixel text-sm text-retro-text font-bold">
                      NEW ORGANIZATION
                    </h2>
                    <p className="font-sans text-xs text-retro-muted">
                      Register an overarching esports organization / league group with staff roster.
                    </p>
                  </PixelStack>
                </div>

                <div
                  onClick={() => { setAppType('TEAM'); setStep(2); }}
                  className={`p-4 rounded border-2 cursor-pointer transition-all ${
                    appType === 'TEAM'
                      ? 'border-retro-primary bg-retro-primary/10'
                      : 'border-retro-border bg-retro-bg hover:border-retro-primary/50'
                  }`}
                >
                  <PixelStack gap={2}>
                    <span className="text-3xl">🏁</span>
                    <h2 className="font-pixel text-sm text-retro-text font-bold">
                      NEW COMPETITIVE TEAM
                    </h2>
                    <p className="font-sans text-xs text-retro-muted">
                      Register a new competitive racing team operating under an approved organization.
                    </p>
                  </PixelStack>
                </div>

                <div
                  onClick={() => { setAppType('EXISTING_TEAM'); setStep(2); }}
                  className={`p-4 rounded border-2 cursor-pointer transition-all ${
                    appType === 'EXISTING_TEAM'
                      ? 'border-retro-primary bg-retro-primary/10'
                      : 'border-retro-border bg-retro-bg hover:border-retro-primary/50'
                  }`}
                >
                  <PixelStack gap={2}>
                    <span className="text-3xl">🏎️</span>
                    <h2 className="font-pixel text-sm text-retro-text font-bold">
                      EXISTING TEAM APP
                    </h2>
                    <p className="font-sans text-xs text-retro-muted">
                      Apply for a pre-existing team to join an approved organization.
                    </p>
                  </PixelStack>
                </div>
              </div>
            </PixelStack>
          )}

          {/* STEP 2: DETAILS OR EXISTING TEAM SELECTION */}
          {step === 2 && (
            <PixelStack gap={4}>
              {appType === 'EXISTING_TEAM' ? (
                <>
                  <PixelSectionHeader title="EXISTING TEAM APPLICATION" size="sm" />
                  <p className="text-xs font-sans text-retro-muted">
                    Select your pre-existing team and the target organization you wish to join.
                  </p>

                  <PixelStack gap={4}>
                    <div>
                      <label className="block font-pixel text-xs text-retro-text mb-1">
                        SELECT EXISTING TEAM <span className="text-red-500">*</span>
                      </label>
                      {userTeams.length === 0 ? (
                        <p className="text-xs text-retro-muted font-sans">No existing teams found.</p>
                      ) : (
                        <select
                          value={selectedExistingTeamId}
                          onChange={(e) => setSelectedExistingTeamId(e.target.value)}
                          className="w-full px-3 py-2 bg-retro-bg border-2 border-retro-border rounded font-sans text-sm text-retro-text focus:border-retro-primary focus:outline-none"
                        >
                          <option value="">-- Choose Existing Team --</option>
                          {userTeams.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name} ({t.slug})
                            </option>
                          ))}
                        </select>
                      )}
                    </div>

                    <div>
                      <label className="block font-pixel text-xs text-retro-text mb-1">
                        TARGET ORGANIZATION <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={primaryOrgId}
                        onChange={(e) => setPrimaryOrgId(e.target.value)}
                        className="w-full px-3 py-2 bg-retro-bg border-2 border-retro-border rounded font-sans text-sm text-retro-text focus:border-retro-primary focus:outline-none"
                      >
                        <option value="">-- Select Target Organization --</option>
                        {approvedOrgs.map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.name} ({o.slug})
                          </option>
                        ))}
                      </select>
                    </div>
                  </PixelStack>

                  <div className="flex justify-between pt-4 border-t border-retro-border">
                    <PixelButton variant="ghost" tone="neutral" onClick={() => setStep(1)}>
                      &lt; BACK
                    </PixelButton>
                    <PixelButton
                      variant="solid"
                      tone="purple"
                      onClick={() => {
                        if (!selectedExistingTeamId) {
                          setError('Please select an existing team.')
                          return
                        }
                        if (!primaryOrgId) {
                          setError('Please select a target organization.')
                          return
                        }
                        setError(null)
                        setStep(3)
                      }}
                    >
                      NEXT &gt;
                    </PixelButton>
                  </div>
                </>
              ) : (
                <>
                  <PixelSectionHeader
                    title={appType === 'ORGANIZATION' ? 'ORGANIZATION DETAILS' : 'TEAM DETAILS'}
                    size="sm"
                  />

                  <PixelStack gap={4}>
                    <PixelInput
                      label="NAME *"
                      placeholder={appType === 'ORGANIZATION' ? 'e.g. Apex Esports Global' : 'e.g. Apex Racing Syndicate'}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />

                    <PixelInput
                      label="CUSTOM SLUG (OPTIONAL)"
                      placeholder="e.g. apex-esports"
                      value={slug}
                      onChange={(e) => setSlug(e.target.value)}
                    />

                    <PixelInput
                      label="LOGO IMAGE URL (OPTIONAL)"
                      placeholder="https://example.com/logo.png"
                      value={logo}
                      onChange={(e) => setLogo(e.target.value)}
                    />

                    {appType === 'ORGANIZATION' && (
                      <>
                        <PixelInput
                          label="DISCORD INVITE URL *"
                          placeholder="https://discord.gg/yourserver"
                          value={discordInvite}
                          onChange={(e) => setDiscordInvite(e.target.value)}
                        />

                        <PixelInput
                          label="VRCHAT GROUP ID *"
                          placeholder="e.g. grp_12345"
                          value={vrchatGroupId}
                          onChange={(e) => setVrchatGroupId(e.target.value)}
                        />
                      </>
                    )}
                  </PixelStack>

                  <div className="flex justify-between pt-4 border-t border-retro-border">
                    <PixelButton variant="ghost" tone="neutral" onClick={() => setStep(1)}>
                      &lt; BACK
                    </PixelButton>
                    <PixelButton
                      variant="solid"
                      tone="purple"
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
                    >
                      NEXT &gt;
                    </PixelButton>
                  </div>
                </>
              )}
            </PixelStack>
          )}

          {/* STEP 3 (ORGANIZATION): STAFF ROSTER */}
          {step === 3 && appType === 'ORGANIZATION' && (
            <PixelStack gap={4}>
              <PixelSectionHeader title="PRELIMINARY STAFF ROSTER" size="sm" />
              <p className="text-xs font-sans text-retro-muted">
                You are automatically set as the primary administrator. You may add up to 2 additional staff administrators (cap of 3 total).
              </p>

              <div>
                <label className="block font-pixel text-xs text-retro-text mb-1">
                  ADD STAFF ADMINISTRATOR
                </label>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <UserSearchCombobox
                      value={newOrgMemberId}
                      onChange={setNewOrgMemberId}
                    />
                  </div>
                  <PixelButton
                    variant="soft"
                    tone="purple"
                    onClick={() => handleAddOrgRosterMember(newOrgMemberId)}
                  >
                    ADD
                  </PixelButton>
                </div>
              </div>

              <div>
                <h3 className="font-pixel text-xs text-retro-text mb-2">CURRENT STAFF ROSTER:</h3>
                <div className="flex flex-col gap-2">
                  <div className="flex justify-between items-center p-2 rounded bg-retro-bg border border-retro-border">
                    <span className="font-sans text-sm text-retro-text">
                      {session?.user.vrchatUsername ?? session?.user.name} <strong>(Creator / Admin)</strong>
                    </span>
                    <PixelBadge tone="green">PRIMARY ADMIN</PixelBadge>
                  </div>
                  {orgRoster.map((uid) => (
                    <div key={uid} className="flex justify-between items-center p-2 rounded bg-retro-bg border border-retro-border">
                      <span className="font-sans text-sm text-retro-text">User ID: {uid}</span>
                      <PixelButton
                        variant="ghost"
                        tone="red"
                        size="sm"
                        onClick={() => handleRemoveOrgRosterMember(uid)}
                      >
                        REMOVE
                      </PixelButton>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-between pt-4 border-t border-retro-border">
                <PixelButton variant="ghost" tone="neutral" onClick={() => setStep(2)}>
                  &lt; BACK
                </PixelButton>
                <PixelButton variant="solid" tone="purple" onClick={() => setStep(4)}>
                  REVIEW & SUBMIT &gt;
                </PixelButton>
              </div>
            </PixelStack>
          )}

          {/* STEP 3 (TEAM): ORGANIZATIONS */}
          {step === 3 && appType === 'TEAM' && (
            <PixelStack gap={4}>
              <PixelSectionHeader title="ORGANIZATION AFFILIATION" size="sm" />

              <PixelStack gap={4}>
                <div>
                  <label className="block font-pixel text-xs text-retro-text mb-1">
                    PRIMARY ORGANIZATION <span className="text-red-500">*</span>
                  </label>
                  {loadingOrgs ? (
                    <p className="text-xs font-sans text-retro-muted">Loading approved organizations...</p>
                  ) : (
                    <select
                      value={primaryOrgId}
                      onChange={(e) => setPrimaryOrgId(e.target.value)}
                      className="w-full px-3 py-2 bg-retro-bg border-2 border-retro-border rounded font-sans text-sm text-retro-text focus:border-retro-primary focus:outline-none"
                    >
                      <option value="">-- Select Primary Organization --</option>
                      {approvedOrgs.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.name} ({o.slug})
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div>
                  <label className="block font-pixel text-xs text-retro-text mb-1">
                    SECONDARY ORGANIZATIONS ("ALSO OPERATES IN...")
                  </label>
                  <PixelStack gap={2}>
                    <select
                      value=""
                      onChange={(e) => {
                        if (e.target.value) {
                          setSecondaryOrgIds([...secondaryOrgIds, e.target.value])
                        }
                      }}
                      className="w-full px-3 py-2 bg-retro-bg border-2 border-retro-border rounded font-sans text-sm text-retro-text focus:border-retro-primary focus:outline-none"
                    >
                      <option value="">-- Add Secondary Organization --</option>
                      {approvedOrgs
                        .filter((o) => o.id !== primaryOrgId && !secondaryOrgIds.includes(o.id))
                        .map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.name} ({o.slug})
                          </option>
                        ))}
                    </select>

                    {secondaryOrgIds.length > 0 && (
                      <div className="flex flex-col gap-2">
                        {secondaryOrgIds.map((secId) => {
                          const org = approvedOrgs.find((o) => o.id === secId)
                          return (
                            <div
                              key={secId}
                              className="flex justify-between items-center p-2 rounded bg-retro-bg border border-retro-border"
                            >
                              <span className="font-sans text-sm text-retro-text font-bold">
                                {org ? `${org.name} (${org.slug})` : secId}
                              </span>
                              <PixelButton
                                variant="ghost"
                                tone="red"
                                size="sm"
                                onClick={() => setSecondaryOrgIds(secondaryOrgIds.filter((id) => id !== secId))}
                              >
                                REMOVE
                              </PixelButton>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </PixelStack>
                </div>
              </PixelStack>

              <div className="flex justify-between pt-4 border-t border-retro-border">
                <PixelButton variant="ghost" tone="neutral" onClick={() => setStep(2)}>
                  &lt; BACK
                </PixelButton>
                <PixelButton
                  variant="solid"
                  tone="purple"
                  onClick={() => {
                    if (!primaryOrgId) {
                      setError('Primary Organization selection is required.')
                      return
                    }
                    setError(null)
                    setStep(4)
                  }}
                >
                  NEXT &gt;
                </PixelButton>
              </div>
            </PixelStack>
          )}

          {/* STEP 4 (TEAM): ROSTER */}
          {step === 4 && appType === 'TEAM' && (
            <PixelStack gap={4}>
              <PixelSectionHeader title="PRELIMINARY TEAM ROSTER" size="sm" />

              <div>
                <label className="block font-pixel text-xs text-retro-text mb-1">
                  ADD TEAM COMPETITOR
                </label>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <UserSearchCombobox
                      value={newTeamMemberId}
                      onChange={setNewTeamMemberId}
                    />
                  </div>
                  <PixelButton
                    variant="soft"
                    tone="purple"
                    onClick={() => handleAddTeamRosterMember(newTeamMemberId)}
                  >
                    ADD
                  </PixelButton>
                </div>
              </div>

              <div>
                <h3 className="font-pixel text-xs text-retro-text mb-2">TEAM MEMBERS:</h3>
                {teamRoster.length === 0 ? (
                  <p className="text-xs font-sans text-retro-muted">No initial team members added yet.</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {teamRoster.map((uid) => (
                      <div key={uid} className="flex justify-between items-center p-2 rounded bg-retro-bg border border-retro-border">
                        <span className="font-sans text-sm text-retro-text">User ID: {uid}</span>
                        <PixelButton
                          variant="ghost"
                          tone="red"
                          size="sm"
                          onClick={() => handleRemoveTeamRosterMember(uid)}
                        >
                          REMOVE
                        </PixelButton>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-between pt-4 border-t border-retro-border">
                <PixelButton variant="ghost" tone="neutral" onClick={() => setStep(3)}>
                  &lt; BACK
                </PixelButton>
                <PixelButton variant="solid" tone="purple" onClick={() => setStep(5)}>
                  REVIEW & SUBMIT &gt;
                </PixelButton>
              </div>
            </PixelStack>
          )}

          {/* REVIEW & SUBMIT STEP */}
          {((step === 4 && appType === 'ORGANIZATION') ||
            (step === 5 && appType === 'TEAM') ||
            (step === 3 && appType === 'EXISTING_TEAM')) && (
            <PixelStack gap={4}>
              <PixelSectionHeader title="REVIEW YOUR APPLICATION" size="sm" />

              <div className="p-4 rounded bg-retro-bg border-2 border-retro-border text-sm font-sans text-retro-text space-y-2">
                <p><strong>TYPE:</strong> {appType === 'EXISTING_TEAM' ? 'EXISTING TEAM APPLICATION' : appType}</p>

                {appType === 'EXISTING_TEAM' ? (
                  <>
                    <p>
                      <strong>TEAM:</strong>{' '}
                      {userTeams.find((t) => t.id === selectedExistingTeamId)?.name || selectedExistingTeamId}
                      {userTeams.find((t) => t.id === selectedExistingTeamId)?.slug && (
                        <span> (@{userTeams.find((t) => t.id === selectedExistingTeamId)?.slug})</span>
                      )}
                    </p>
                    <p>
                      <strong>TARGET ORGANIZATION:</strong>{' '}
                      {approvedOrgs.find((o) => o.id === primaryOrgId)?.name || primaryOrgId}
                    </p>
                  </>
                ) : (
                  <>
                    <p><strong>NAME:</strong> {name}</p>
                    {slug && <p><strong>SLUG:</strong> {slug}</p>}

                    {appType === 'ORGANIZATION' && (
                      <>
                        <p><strong>DISCORD INVITE:</strong> {discordInvite}</p>
                        <p><strong>VRCHAT GROUP ID:</strong> {vrchatGroupId}</p>
                      </>
                    )}

                    {appType === 'TEAM' && (
                      <>
                        <p>
                          <strong>PRIMARY ORGANIZATION:</strong>{' '}
                          {approvedOrgs.find((o) => o.id === primaryOrgId)?.name || primaryOrgId}
                        </p>
                        {secondaryOrgIds.length > 0 && (
                          <p>
                            <strong>SECONDARY ORGANIZATIONS:</strong>{' '}
                            {secondaryOrgIds
                              .map((secId) => approvedOrgs.find((o) => o.id === secId)?.name || secId)
                              .join(', ')}
                          </p>
                        )}
                      </>
                    )}
                  </>
                )}
              </div>

              <div className="flex justify-between pt-4 border-t border-retro-border">
                <PixelButton
                  variant="ghost"
                  tone="neutral"
                  disabled={submitting}
                  onClick={() => setStep(step - 1)}
                >
                  &lt; BACK
                </PixelButton>
                <PixelButton
                  variant="solid"
                  tone="purple"
                  loading={submitting}
                  disabled={submitting}
                  onClick={() => void handleSubmit()}
                >
                  {submitting ? 'SUBMITTING...' : 'CONFIRM & SUBMIT APPLICATION'}
                </PixelButton>
              </div>
            </PixelStack>
          )}
        </PixelStack>
      </PixelCard>
    </PixelContainer>
  </ManagementLayout>
)
}

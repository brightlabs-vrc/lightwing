import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { Avatar, Button, Flash, FormControl, Label, Select, Textarea, TextInput } from '@primer/react'
import { ArrowLeftIcon, PencilIcon, PlusIcon, TrashIcon } from '@primer/octicons-react'
import { useAuth } from '../../../hooks/useAuth'
import { requireAdminPanel } from '../../../lib/auth-guard'
import {
  deleteAdminUser,
  getAdminUserProfile,
  listApprovedOrganizations,
  listUserOrgClassGrades,
  updateAdminUserClass,
  updateAdminUserProfile,
  updateAdminUserSiteRole,
} from '../../../lib/admin-api'
import { isValidUserSlug } from '../../../lib/slugs'
import { AdminLayout } from '../-AdminLayout'
import { AlertBanner } from '../../../components/AlertBanner'
import { PrimerSkeletonDetail } from '../../../components/LoadingSkeleton'
import { MarkdownView } from '../../../components/MarkdownView'
import { DangerZoneDeleteDialog } from '../../../components/DangerZoneDeleteDialog'
import type { auth, eventmanager, teammanager } from '../../../lib/client'
import type { ClassTier, SiteRole } from '../../../types'

export const Route = createFileRoute('/admin/users/$userId')({
  beforeLoad: async ({ location }) => {
    await requireAdminPanel(location)
  },
  component: AdminUserDetailPage,
})

function AdminUserDetailPage() {
  const { userId } = Route.useParams()
  const navigate = useNavigate()
  const { session } = useAuth()
  const isSiteAdmin = session?.user.siteRole === 'SITE_ADMIN'
  const isSelf = userId === session?.user.id

  const [profile, setProfile] = useState<auth.UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [updatingRole, setUpdatingRole] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [orgClasses, setOrgClasses] = useState<eventmanager.UserOrgClassEntry[]>([])
  const [orgs, setOrgs] = useState<teammanager.LinkedOrganization[]>([])
  const [newGradeOrgId, setNewGradeOrgId] = useState('')
  const [newGradeTier, setNewGradeTier] = useState<ClassTier>('G3')
  const [savingOrgGrade, setSavingOrgGrade] = useState(false)

  const [isEditing, setIsEditing] = useState(false)
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [biography, setBiography] = useState('')
  const [vrchatUsername, setVrchatUsername] = useState('')
  const [image, setImage] = useState('')

  const authHeader = useMemo(() => {
    const token = session?.session.token
    return token ? `Bearer ${token}` : null
  }, [session?.session.token])

  async function loadOrgClasses() {
    try {
      const [classesRes, orgsRes] = await Promise.all([
        listUserOrgClassGrades(userId),
        listApprovedOrganizations(),
      ])
      setOrgClasses(classesRes.classes ?? [])
      setOrgs(orgsRes.organizations ?? [])
    } catch {
      // non-fatal
    }
  }

  async function loadProfile() {
    setLoading(true)
    setError(null)
    setSuccess(null)
    try {
      const loaded = await getAdminUserProfile(userId)
      setProfile(loaded)
      setName(loaded.name || '')
      setSlug(loaded.slug || '')
      setBiography(loaded.biography || '')
      setVrchatUsername(loaded.vrchatUsername || '')
      setImage(loaded.image || '')
      await loadOrgClasses()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load participant profile')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadProfile()
  }, [userId])

  function handleCancelEdit() {
    if (profile) {
      setName(profile.name || '')
      setSlug(profile.slug || '')
      setBiography(profile.biography || '')
      setVrchatUsername(profile.vrchatUsername || '')
      setImage(profile.image || '')
    }
    setError(null)
    setSuccess(null)
    setIsEditing(false)
  }

  async function handleSaveOrgClass(organizationId: string, tier: ClassTier | null) {
    if (!profile || !authHeader || !organizationId) return
    setSavingOrgGrade(true)
    setError(null)
    setSuccess(null)
    try {
      await updateAdminUserClass(profile.id, organizationId, tier, authHeader)
      await loadOrgClasses()
      setSuccess(tier ? 'Updated organization class grade.' : 'Cleared organization class grade.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to update organization class grade.')
    } finally {
      setSavingOrgGrade(false)
    }
  }

  async function handleSaveChanges(e: React.FormEvent) {
    e.preventDefault()
    if (!profile || !authHeader) {
      setError('System authentication is required.')
      return
    }

    const trimmedSlug = slug.trim()
    if (trimmedSlug && (trimmedSlug.length < 4 || trimmedSlug.length > 24)) {
      setError('@username must be between 4 and 24 characters.')
      return
    }
    if (trimmedSlug && !isValidUserSlug(trimmedSlug)) {
      setError('@username must contain only lowercase letters, numbers, periods, dashes, and underscores.')
      return
    }

    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      const updated = await updateAdminUserProfile(
        profile.id,
        {
          name,
          slug: trimmedSlug || undefined,
          biography: biography.trim() || null,
          vrchatUsername: vrchatUsername.trim() || null,
          image: image.trim() || null,
        },
        authHeader,
      )
      setProfile(updated)
      setSuccess('Successfully updated participant account details.')
      setIsEditing(false)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to save participant changes.')
    } finally {
      setSaving(false)
    }
  }

  async function adjustSiteRole(siteRole: SiteRole) {
    if (!profile || !authHeader) return
    setUpdatingRole(true)
    setError(null)
    setSuccess(null)
    try {
      const updated = await updateAdminUserSiteRole(profile.id, siteRole, authHeader)
      setProfile(updated)
      setSuccess(`Updated site role for ${profile.name} to ${siteRole}.`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to adjust site role')
    } finally {
      setUpdatingRole(false)
    }
  }

  async function handleDeleteUser() {
    if (!profile || !authHeader) return
    await deleteAdminUser(profile.id, authHeader)
    void navigate({ to: '/admin/users' })
  }

  return (
    <AdminLayout
      title={profile ? profile.vrchatUsername || profile.name : 'User Detail'}
      subtitle={profile ? `@${profile.slug || 'unassigned'} · User ID: ${profile.id}` : `User ID: ${userId}`}
      breadcrumbs={[
        { label: 'Admin', to: '/admin' },
        { label: 'Users', to: '/admin/users' },
        { label: profile ? profile.vrchatUsername || profile.name : userId },
      ]}
      actions={
        <div style={{ display: 'flex', gap: '8px' }}>
          <Link to="/admin/users" style={{ textDecoration: 'none' }}>
            <Button leadingVisual={ArrowLeftIcon}>Back to Users</Button>
          </Link>
          {isSiteAdmin && profile && !isEditing && (
            <Button variant="primary" leadingVisual={PencilIcon} onClick={() => setIsEditing(true)}>
              Edit Profile
            </Button>
          )}
        </div>
      }
    >
      {error && <AlertBanner variant="error">{error}</AlertBanner>}
      {success && <AlertBanner variant="success">{success}</AlertBanner>}

      {loading ? (
        <PrimerSkeletonDetail />
      ) : profile ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Identity & Biography Section */}
          <section className="primer-box">
            <div className="primer-box-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>
                {isEditing ? 'Edit Competitor Account' : 'Competitor Identity & Profile'}
              </h2>
              <Label
                variant={
                  profile.siteRole === 'SITE_ADMIN'
                    ? 'accent'
                    : profile.siteRole === 'EVENT_ADMIN'
                    ? 'attention'
                    : 'secondary'
                }
              >
                {profile.siteRole}
              </Label>
            </div>

            <div style={{ padding: '20px' }}>
              {isEditing ? (
                <form onSubmit={(e) => void handleSaveChanges(e)} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px' }}>
                    <FormControl>
                      <FormControl.Label>Full Name</FormControl.Label>
                      <TextInput block value={name} onChange={(e) => setName(e.target.value)} />
                    </FormControl>

                    <FormControl>
                      <FormControl.Label>@username</FormControl.Label>
                      <TextInput block value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="e.g. thunder" />
                      <FormControl.Caption>4–24 lowercase letters, numbers, periods, dashes, or underscores.</FormControl.Caption>
                    </FormControl>

                    <FormControl>
                      <FormControl.Label>VRChat Username</FormControl.Label>
                      <TextInput block value={vrchatUsername} onChange={(e) => setVrchatUsername(e.target.value)} placeholder="e.g. VRC_User" />
                    </FormControl>

                    <FormControl>
                      <FormControl.Label>Profile Image URL</FormControl.Label>
                      <TextInput block value={image} onChange={(e) => setImage(e.target.value)} placeholder="https://example.com/avatar.png" />
                    </FormControl>
                  </div>

                  <FormControl>
                    <FormControl.Label>Biography (Markdown)</FormControl.Label>
                    <Textarea
                      block
                      rows={4}
                      value={biography}
                      onChange={(e) => setBiography(e.target.value)}
                      placeholder="Competitor bio..."
                    />
                  </FormControl>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', paddingTop: '8px', borderTop: '1px solid var(--borderColor-muted, #d8dee4)' }}>
                    <Button type="button" onClick={handleCancelEdit} disabled={saving}>
                      Cancel
                    </Button>
                    <Button type="submit" variant="primary" disabled={saving}>
                      {saving ? 'Saving...' : 'Save Changes'}
                    </Button>
                  </div>
                </form>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                    <Avatar
                      src={profile.image || '/fallback_avatar.jpg'}
                      size={64}
                      alt={`${profile.name}'s Avatar`}
                    />
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', flex: '1 1 320px' }}>
                      <div>
                        <div style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 600, color: 'var(--fgColor-muted, #636c76)' }}>
                          Display Name
                        </div>
                        <div style={{ fontSize: '15px', fontWeight: 600 }}>{profile.name || 'None'}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 600, color: 'var(--fgColor-muted, #636c76)' }}>
                          @username
                        </div>
                        <div style={{ fontSize: '14px' }}>@{profile.slug || 'None'}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 600, color: 'var(--fgColor-muted, #636c76)' }}>
                          VRChat Username
                        </div>
                        <div style={{ fontSize: '14px' }}>{profile.vrchatUsername || 'None'}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 600, color: 'var(--fgColor-muted, #636c76)' }}>
                          Competitor ID
                        </div>
                        <code style={{ fontSize: '12px', color: 'var(--fgColor-muted, #636c76)' }}>{profile.id}</code>
                      </div>
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 600, color: 'var(--fgColor-muted, #636c76)', marginBottom: '6px' }}>
                      Biography
                    </div>
                    <div
                      style={{
                        backgroundColor: 'var(--bgColor-muted, #f6f8fa)',
                        border: '1px solid var(--borderColor-muted, #d8dee4)',
                        borderRadius: '6px',
                        padding: '12px 14px',
                      }}
                    >
                      <MarkdownView content={profile.biography} fallbackText="No biography registered." />
                    </div>
                  </div>

                  {!isSiteAdmin && (
                    <Flash variant="default" style={{ fontSize: '12px' }}>
                      Read-only view (Event Administrator access). Site Administrator privileges are required to edit or delete user accounts.
                    </Flash>
                  )}
                </div>
              )}
            </div>
          </section>

          {/* Organization Class Grades */}
          <section className="primer-box">
            <div className="primer-box-header">
              <h2 style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>Organization Class Grades</h2>
            </div>
            <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {orgClasses.length > 0 ? (
                <div style={{ overflowX: 'auto', border: '1px solid var(--borderColor-default, #d0d7de)', borderRadius: '6px' }}>
                  <table className="primer-table">
                    <thead>
                      <tr>
                        <th>Organization</th>
                        <th style={{ width: '160px' }}>Class Grade</th>
                        <th style={{ width: '100px', textAlign: 'right' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orgClasses.map((oc) => (
                        <tr key={oc.organizationId}>
                          <td>
                            <Link
                              to="/admin/organizations/$orgId"
                              params={{ orgId: oc.organizationId }}
                              style={{ fontWeight: 600, color: 'var(--fgColor-accent, #0969da)', textDecoration: 'none' }}
                            >
                              {oc.organizationName}
                            </Link>{' '}
                            <span style={{ fontSize: '12px', color: 'var(--fgColor-muted, #636c76)' }}>
                              (@{oc.organizationSlug})
                            </span>
                          </td>
                          <td>
                            <Select
                              size="small"
                              value={oc.classTier || ''}
                              disabled={savingOrgGrade}
                              onChange={(e) => {
                                const v = e.target.value as ClassTier | ''
                                void handleSaveOrgClass(oc.organizationId, v === '' ? null : v)
                              }}
                            >
                              <Select.Option value="">OPEN (Clear)</Select.Option>
                              <Select.Option value="G3">G3</Select.Option>
                              <Select.Option value="G2">G2</Select.Option>
                              <Select.Option value="G1">G1</Select.Option>
                            </Select>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <Button
                              size="small"
                              variant="danger"
                              leadingVisual={TrashIcon}
                              disabled={savingOrgGrade}
                              onClick={() => void handleSaveOrgClass(oc.organizationId, null)}
                            >
                              Clear
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p style={{ margin: 0, fontSize: '13px', color: 'var(--fgColor-muted, #636c76)' }}>
                  No organization-scoped class grades assigned (defaults to OPEN).
                </p>
              )}

              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                <Select
                  size="small"
                  value={newGradeOrgId}
                  onChange={(e) => setNewGradeOrgId(e.target.value)}
                >
                  <Select.Option value="">Select organization...</Select.Option>
                  {orgs.map((o) => (
                    <Select.Option key={o.id} value={o.id}>
                      {o.name} (@{o.slug})
                    </Select.Option>
                  ))}
                </Select>
                <Select
                  size="small"
                  value={newGradeTier}
                  onChange={(e) => setNewGradeTier(e.target.value as ClassTier)}
                >
                  <Select.Option value="G3">G3</Select.Option>
                  <Select.Option value="G2">G2</Select.Option>
                  <Select.Option value="G1">G1</Select.Option>
                </Select>
                <Button
                  size="small"
                  variant="primary"
                  leadingVisual={PlusIcon}
                  disabled={!newGradeOrgId || savingOrgGrade}
                  onClick={() => {
                    if (!newGradeOrgId) return
                    void handleSaveOrgClass(newGradeOrgId, newGradeTier)
                    setNewGradeOrgId('')
                  }}
                >
                  Assign Grade
                </Button>
              </div>
            </div>
          </section>

          {/* Active Team & Organization Affiliations */}
          <section className="primer-box">
            <div className="primer-box-header">
              <h2 style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>Active Team &amp; Organization Affiliations</h2>
            </div>
            <div style={{ padding: '16px' }}>
              {profile.teams && profile.teams.length > 0 ? (
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  {profile.teams.map((t) => (
                    <div
                      key={t.organizationId}
                      style={{
                        padding: '8px 12px',
                        borderRadius: '6px',
                        border: '1px solid var(--borderColor-default, #d0d7de)',
                        backgroundColor: 'var(--bgColor-muted, #f6f8fa)',
                      }}
                    >
                      <div style={{ fontWeight: 600, fontSize: '13px' }}>{t.name}</div>
                      <div style={{ fontSize: '11px', color: 'var(--fgColor-muted, #636c76)' }}>
                        Role: <strong>{t.role}</strong>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ margin: 0, fontSize: '13px', color: 'var(--fgColor-muted, #636c76)' }}>
                  This user is not currently affiliated with any organizations or teams.
                </p>
              )}
            </div>
          </section>

          {/* Global Authorization Privileges (SITE_ADMIN only) */}
          {isSiteAdmin && (
            <section className="primer-box">
              <div className="primer-box-header">
                <h2 style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>Global Authorization Privileges</h2>
              </div>
              <div style={{ padding: '16px' }}>
                {!isSelf ? (
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <Button
                      type="button"
                      variant={profile.siteRole === 'SITE_ADMIN' ? 'primary' : 'default'}
                      disabled={updatingRole || profile.siteRole === 'SITE_ADMIN'}
                      onClick={() => void adjustSiteRole('SITE_ADMIN')}
                    >
                      Grant SITE_ADMIN
                    </Button>
                    <Button
                      type="button"
                      disabled={updatingRole || profile.siteRole === 'EVENT_ADMIN'}
                      onClick={() => void adjustSiteRole('EVENT_ADMIN')}
                    >
                      Set EVENT_ADMIN
                    </Button>
                    <Button
                      type="button"
                      variant="danger"
                      disabled={updatingRole || profile.siteRole === 'USER'}
                      onClick={() => void adjustSiteRole('USER')}
                    >
                      Revoke to USER
                    </Button>
                  </div>
                ) : (
                  <Flash variant="warning" style={{ fontSize: '13px' }}>
                    <strong>Self-Privilege Safeguard:</strong> You cannot modify your own global site role or delete your own active account.
                  </Flash>
                )}
              </div>
            </section>
          )}

          {/* Danger Zone (SITE_ADMIN only, blocked for self) */}
          {isSiteAdmin && !isSelf && (
            <DangerZoneDeleteDialog
              entityType="user"
              entityName={profile.vrchatUsername || profile.name}
              confirmText={profile.slug || profile.name}
              cardDescription="Permanently delete this user account along with their sessions, team/organization memberships, event registrations, race results, and ratings."
              consequences={[
                'All active sessions and linked Discord/OAuth accounts.',
                'All organization and competitive team memberships.',
                'All event registrations, race results, Glicko-2 ratings, and organization class grades.',
              ]}
              onConfirmDelete={handleDeleteUser}
            />
          )}
        </div>
      ) : (
        <div className="primer-box" style={{ padding: '32px', textAlign: 'center', color: 'var(--fgColor-muted, #636c76)' }}>
          Profile was not found.
        </div>
      )}
    </AdminLayout>
  )
}

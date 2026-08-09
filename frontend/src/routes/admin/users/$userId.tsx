import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../../hooks/useAuth'
import { requireSiteAdmin } from '../../../lib/auth-guard'
import { getAdminUserProfile, updateAdminUserSiteRole, updateAdminUserProfile, updateAdminUserClass } from '../../../lib/admin-api'
import { AdminLayout } from '../-AdminLayout'
import { AlertBanner } from '../../../components/AlertBanner'
import { Heading, Text, Label, Button, TextInput, FormControl, Textarea, Select } from '@primer/react'
import type { auth, eventmanager } from '../../../lib/client'

export const Route = createFileRoute('/admin/users/$userId')({
  beforeLoad: async ({ location }) => {
    await requireSiteAdmin(location)
  },
  component: AdminUserDetailPage,
})

function AdminUserDetailPage() {
  const { userId } = Route.useParams()
  const { session } = useAuth()
  const [profile, setProfile] = useState<auth.UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [updatingRole, setUpdatingRole] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [isEditing, setIsEditing] = useState(false)

  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [biography, setBiography] = useState('')
  const [careerOverview, setCareerOverview] = useState('')
  const [vrchatUsername, setVrchatUsername] = useState('')
  const [image, setImage] = useState('')
  const [classTier, setClassTier] = useState<string>('')

  const authHeader = useMemo(() => {
    const token = session?.session.token
    return token ? `Bearer ${token}` : null
  }, [session?.session.token])

  async function loadProfile() {
    setLoading(true)
    setError(null)
    setSuccess(null)
    try {
      const loaded = await getAdminUserProfile(userId)
      const normalizedProfile = {
        ...loaded,
        classTier: (loaded.classTier === 'PRE_OP' || loaded.classTier === 'OP') ? null : loaded.classTier
      }
      setProfile(normalizedProfile)
      setName(loaded.name || '')
      setSlug(loaded.slug || '')
      setBiography(loaded.biography || '')
      setCareerOverview(loaded.careerOverview || '')
      setVrchatUsername(loaded.vrchatUsername || '')
      setImage(loaded.image || '')
      setClassTier(normalizedProfile.classTier || '')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load competitor profile')
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
      setCareerOverview(profile.careerOverview || '')
      setVrchatUsername(profile.vrchatUsername || '')
      setImage(profile.image || '')
      setClassTier(profile.classTier || '')
    }
    setError(null)
    setSuccess(null)
    setIsEditing(false)
  }

  async function handleSaveChanges() {
    if (!profile || !authHeader) {
      setError('System authentication is required.')
      return
    }

    const trimmedSlug = slug.trim()
    if (trimmedSlug && (trimmedSlug.length < 4 || trimmedSlug.length > 24)) {
      setError('Slug must be between 4 and 24 characters.')
      return
    }
    if (trimmedSlug && !/^[a-z0-9]+$/.test(trimmedSlug)) {
      setError('Slug must contain only lowercase letters and numbers.')
      return
    }

    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      let currentProfile = profile

      const profileChanged =
        name !== (profile.name || '') ||
        trimmedSlug !== (profile.slug || '') ||
        biography !== (profile.biography || '') ||
        careerOverview !== (profile.careerOverview || '') ||
        vrchatUsername !== (profile.vrchatUsername || '') ||
        image !== (profile.image || '')

      if (profileChanged) {
        currentProfile = await updateAdminUserProfile(
          profile.id,
          {
            name,
            slug: trimmedSlug || undefined,
            biography: biography.trim() || null,
            careerOverview: careerOverview.trim() || null,
            vrchatUsername: vrchatUsername.trim() || null,
            image: image.trim() || null,
          },
          authHeader,
        )
      }

      const nextTier = classTier === '' ? null : (classTier as eventmanager.ClassTier)
      const classTierChanged = nextTier !== profile.classTier

      if (classTierChanged) {
        await updateAdminUserClass(profile.id, nextTier, authHeader)
        currentProfile = {
          ...currentProfile,
          classTier: nextTier,
        }
      }

      setProfile(currentProfile)
      setSuccess('Successfully updated competitor account details.')
      setIsEditing(false)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to save competitor changes.')
    } finally {
      setSaving(false)
    }
  }

  async function adjustSiteRole(siteRole: auth.SiteRoleName) {
    if (!profile || !authHeader) {
      setError('System authentication is required.')
      return
    }

    setUpdatingRole(true)
    setError(null)
    setSuccess(null)
    try {
      const updated = await updateAdminUserSiteRole(profile.id, siteRole, authHeader)
      setProfile(updated)
      setSuccess(`Successfully updated the site role for ${profile.name} to ${siteRole}.`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to adjust site role')
    } finally {
      setUpdatingRole(false)
    }
  }

  return (
    <AdminLayout>
      <div style={{
        border: '1px solid var(--color-border-default)',
        borderRadius: '6px',
        backgroundColor: 'var(--color-canvas-default)',
        boxShadow: 'var(--color-shadow-small)',
        overflow: 'hidden'
      }}>
        <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--color-border-default)' }}>
          <Heading as="h2" style={{ fontSize: '18px', margin: 0 }}>
            {isEditing ? 'Configure Competitor Account Parameters' : 'Competitor Account Details'}
          </Heading>
        </div>

        <div style={{ padding: '1.5rem' }}>
          {error && (
            <div style={{ marginBottom: '1rem' }}>
              <AlertBanner variant="error">{error}</AlertBanner>
            </div>
          )}
          {success && (
            <div style={{ marginBottom: '1rem' }}>
              <AlertBanner variant="success">{success}</AlertBanner>
            </div>
          )}

          {loading ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-fg-muted)' }}>
              <p>Loading user profile...</p>
            </div>
          ) : profile ? (
            <div>
              {isEditing ? (
                /* EDIT MODE FORM */
                <div>
                  <div style={{
                    backgroundColor: 'var(--color-canvas-subtle)',
                    border: '1px solid var(--color-border-default)',
                    borderRadius: '6px',
                    padding: '1.5rem',
                    marginBottom: '1.5rem'
                  }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
                      {/* Full Name Input */}
                      <FormControl>
                        <FormControl.Label style={{ fontWeight: 'bold' }}>Full Name</FormControl.Label>
                        <TextInput
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          style={{ width: '100%' }}
                        />
                      </FormControl>

                      {/* Slug Input */}
                      <FormControl>
                        <FormControl.Label style={{ fontWeight: 'bold' }}>Slug (Handle)</FormControl.Label>
                        <TextInput
                          value={slug}
                          onChange={(e) => setSlug(e.target.value)}
                          placeholder="e.g. thunder"
                          style={{ width: '100%' }}
                        />
                        <FormControl.Caption>
                          Slugs must be between 4 and 24 lowercase alphanumeric characters.
                        </FormControl.Caption>
                      </FormControl>

                      {/* VRChat Username Input */}
                      <FormControl>
                        <FormControl.Label style={{ fontWeight: 'bold' }}>VRChat Username</FormControl.Label>
                        <TextInput
                          value={vrchatUsername}
                          onChange={(e) => setVrchatUsername(e.target.value)}
                          placeholder="e.g. VRC_User"
                          style={{ width: '100%' }}
                        />
                      </FormControl>

                      {/* Profile Image Input */}
                      <FormControl>
                        <FormControl.Label style={{ fontWeight: 'bold' }}>Profile Image URL</FormControl.Label>
                        <TextInput
                          value={image}
                          onChange={(e) => setImage(e.target.value)}
                          placeholder="e.g. https://example.com/image.png"
                          style={{ width: '100%' }}
                        />
                      </FormControl>

                      {/* Skill Class Tier Dropdown Selector */}
                      <FormControl>
                        <FormControl.Label style={{ fontWeight: 'bold' }}>Skill Class Tier</FormControl.Label>
                        <Select
                          value={classTier || ''}
                          onChange={(e) => setClassTier(e.target.value)}
                          style={{ width: '100%' }}
                        >
                          <option value="">None (Default)</option>
                          <option value="G3">G3</option>
                          <option value="G2">G2</option>
                          <option value="G1">G1</option>
                        </Select>
                      </FormControl>
                    </div>
                  </div>

                  {/* Biography Input Field */}
                  <div style={{ marginBottom: '1.5rem' }}>
                    <FormControl>
                      <FormControl.Label style={{ fontWeight: 'bold' }}>Biography</FormControl.Label>
                      <Textarea
                        value={biography}
                        onChange={(e) => setBiography(e.target.value)}
                        placeholder="Tell us about yourself..."
                        style={{ width: '100%' }}
                        rows={4}
                      />
                    </FormControl>
                  </div>

                  {/* Career Overview Input Field */}
                  <div style={{ marginBottom: '1.5rem' }}>
                    <FormControl>
                      <FormControl.Label style={{ fontWeight: 'bold' }}>Career Overview</FormControl.Label>
                      <Textarea
                        value={careerOverview}
                        onChange={(e) => setCareerOverview(e.target.value)}
                        placeholder="Detail your competitive history and highlights..."
                        style={{ width: '100%' }}
                        rows={4}
                      />
                    </FormControl>
                  </div>

                  {/* Form Actions */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginBottom: '1.5rem' }}>
                    <Button onClick={handleCancelEdit} disabled={saving}>
                      Cancel
                    </Button>
                    <Button variant="primary" onClick={handleSaveChanges} disabled={saving || loading}>
                      {saving ? 'Saving...' : 'Save Changes'}
                    </Button>
                  </div>
                </div>
              ) : (
                /* DETAILS VIEW (READ-focused) */
                <div>
                  <div style={{
                    backgroundColor: 'var(--color-canvas-subtle)',
                    border: '1px solid var(--color-border-default)',
                    borderRadius: '6px',
                    padding: '1.5rem',
                    marginBottom: '1.5rem'
                  }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '2rem' }}>
                      {/* Avatar Column */}
                      <div style={{ display: 'flex', justifyContent: 'center' }}>
                        {profile.image ? (
                          <img
                            src={profile.image}
                            alt={`${profile.name}'s Avatar`}
                            style={{
                              width: '110px',
                              height: '110px',
                              borderRadius: '50%',
                              objectFit: 'cover',
                              border: '2px solid var(--color-border-default)',
                              boxShadow: 'var(--color-shadow-medium)',
                            }}
                          />
                        ) : (
                          <div
                            style={{
                              width: '110px',
                              height: '110px',
                              borderRadius: '50%',
                              backgroundColor: 'var(--color-canvas-subtle)',
                              color: 'var(--color-fg-muted)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '2.5rem',
                              fontWeight: 'bold',
                              border: '2px solid var(--color-border-default)',
                              boxShadow: 'var(--color-shadow-medium)',
                            }}
                          >
                            {profile.name ? profile.name.charAt(0).toUpperCase() : 'U'}
                          </div>
                        )}
                      </div>

                      {/* Details Column */}
                      <div style={{ flexGrow: 1 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
                          {/* Full Name */}
                          <div>
                            <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--color-fg-muted)', fontWeight: 'bold', display: 'block', marginBottom: '0.25rem' }}>Full Name</span>
                            <span style={{ fontSize: '18px', fontWeight: 'bold', color: 'var(--color-fg-default)' }}>{profile.name || 'None'}</span>
                          </div>

                          {/* Slug */}
                          <div>
                            <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--color-fg-muted)', fontWeight: 'bold', display: 'block', marginBottom: '0.25rem' }}>Slug (Handle)</span>
                            <span style={{ fontSize: '16px', color: 'var(--color-fg-muted)' }}>@{profile.slug || 'None'}</span>
                          </div>

                          {/* VRChat Username */}
                          <div>
                            <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--color-fg-muted)', fontWeight: 'bold', display: 'block', marginBottom: '0.25rem' }}>VRChat Username</span>
                            <span style={{ fontSize: '16px', color: 'var(--color-fg-muted)' }}>{profile.vrchatUsername || 'None'}</span>
                          </div>

                          {/* Skill Class Tier */}
                          <div>
                            <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--color-fg-muted)', fontWeight: 'bold', display: 'block', marginBottom: '0.25rem' }}>Skill Class Tier</span>
                            <Label variant="default">
                              {profile.classTier || 'None / PRE_OP'}
                            </Label>
                          </div>

                          {/* System Site Role */}
                          <div>
                            <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--color-fg-muted)', fontWeight: 'bold', display: 'block', marginBottom: '0.25rem' }}>System Site Role</span>
                            <Label variant={profile.siteRole === 'SITE_ADMIN' ? 'success' : 'default'}>
                              {profile.siteRole}
                            </Label>
                          </div>

                          {/* Active Competitor ID */}
                          <div>
                            <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--color-fg-muted)', fontWeight: 'bold', display: 'block', marginBottom: '0.25rem' }}>Active Competitor ID</span>
                            <code style={{ fontSize: '12px', display: 'block', padding: '4px 0' }}>{profile.id}</code>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Biography */}
                  <div style={{ marginBottom: '1.5rem' }}>
                    <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--color-fg-muted)', fontWeight: 'bold', display: 'block', marginBottom: '0.25rem' }}>Biography</span>
                    <div style={{ whiteSpace: 'pre-wrap', backgroundColor: 'var(--color-canvas-subtle)', padding: '12px', borderRadius: '6px', border: '1px solid var(--color-border-default)', minHeight: '60px', color: 'var(--color-fg-default)' }}>
                      {profile.biography ? profile.biography : <span style={{ color: 'var(--color-fg-muted)', fontStyle: 'italic' }}>No biography registered.</span>}
                    </div>
                  </div>

                  {/* Career Overview */}
                  <div style={{ marginBottom: '1.5rem' }}>
                    <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--color-fg-muted)', fontWeight: 'bold', display: 'block', marginBottom: '0.25rem' }}>Career Overview</span>
                    <div style={{ whiteSpace: 'pre-wrap', backgroundColor: 'var(--color-canvas-subtle)', padding: '12px', borderRadius: '6px', border: '1px solid var(--color-border-default)', minHeight: '60px', color: 'var(--color-fg-default)' }}>
                      {profile.careerOverview ? profile.careerOverview : <span style={{ color: 'var(--color-fg-muted)', fontStyle: 'italic' }}>No career overview highlights registered.</span>}
                    </div>
                  </div>

                  {/* Trigger Edit Button */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1.5rem' }}>
                    <Button variant="primary" onClick={() => setIsEditing(true)}>
                      Edit Profile Details
                    </Button>
                  </div>
                </div>
              )}

              {/* Active Team Affiliations */}
              <div style={{ borderTop: '1px solid var(--color-border-default)', paddingTop: '1.5rem', marginBottom: '1.5rem' }}>
                <p style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--color-fg-muted)', fontWeight: 'bold', marginBottom: '0.5rem' }}>Active Team Affiliations</p>
                {profile.teams && profile.teams.length > 0 ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {profile.teams.map((t) => (
                      <div key={t.organizationId} style={{ backgroundColor: 'var(--color-canvas-subtle)', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--color-border-default)' }}>
                        <p style={{ fontWeight: 'bold', margin: 0 }}>{t.name}</p>
                        <p style={{ color: 'var(--color-fg-muted)', fontSize: '11px', margin: '4px 0 0 0' }}>Role: <span style={{ fontWeight: 'bold' }}>{t.role}</span></p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ color: 'var(--color-fg-muted)', fontSize: '14px' }}>This competitor is not currently affiliated with any registered organization teams.</p>
                )}
              </div>

              {/* SITE ROLE ADJUSTMENT ACTIONS */}
              {userId !== session?.user.id ? (
                <div style={{ borderTop: '1px solid var(--color-border-default)', paddingTop: '1.5rem' }}>
                  <p style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--color-fg-muted)', fontWeight: 'bold', marginBottom: '0.5rem' }}>Adjust Global Authorization Privilege</p>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <Button
                      onClick={() => adjustSiteRole('SITE_ADMIN')}
                      disabled={updatingRole || profile.siteRole === 'SITE_ADMIN'}
                      style={{ backgroundColor: 'var(--color-success-emphasis)', color: 'var(--color-fg-onEmphasis)' }}
                    >
                      Grant SITE_ADMIN Privilege
                    </Button>
                    <Button
                      onClick={() => adjustSiteRole('USER')}
                      disabled={updatingRole || profile.siteRole === 'USER'}
                      style={{ backgroundColor: 'var(--color-danger-emphasis)', color: 'var(--color-fg-onEmphasis)' }}
                    >
                      Revoke to USER Privilege
                    </Button>
                  </div>
                </div>
              ) : (
                <div style={{ backgroundColor: 'var(--color-attention-subtle)', border: '1px solid var(--color-attention-border)', borderRadius: '6px', padding: '1rem', marginTop: '1.5rem' }}>
                  <p style={{ color: 'var(--color-attention-fg)', fontWeight: 'bold', margin: 0 }}>
                    Self-Privilege Safeguard
                  </p>
                  <p style={{ color: 'var(--color-fg-muted)', fontSize: '12px', margin: '4px 0 0 0' }}>
                    You cannot modify your own global siteRole privileges while active in your current session.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-fg-muted)', border: '1px dashed var(--color-border-default)', borderRadius: '6px' }}>
              <p>Profile was not found or is empty.</p>
            </div>
          )}
        </div>

        <div style={{ padding: '1rem', borderTop: '1px solid var(--color-border-default)', backgroundColor: 'var(--color-canvas-subtle)' }}>
          <Button as={Link} to="/admin/users">
            Back to Competitor Directory
          </Button>
        </div>
      </div>
    </AdminLayout>
  )
}

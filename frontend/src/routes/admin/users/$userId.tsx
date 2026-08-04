import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../../hooks/useAuth'
import { requireSiteAdmin } from '../../../lib/auth-guard'
import { getAdminUserProfile, updateAdminUserSiteRole, updateAdminUserProfile, updateAdminUserClass } from '../../../lib/admin-api'
import { AdminLayout } from '../-AdminLayout'
import { AlertBanner } from '../../../components/AlertBanner'
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

  // Mode state: false = Details view, true = Edit view
  const [isEditing, setIsEditing] = useState(false)

  // Local state for editable fields
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

      // 1. Update Profile Fields if changed
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

      // 2. Update Class Tier if changed
      const nextTier = classTier === '' ? null : (classTier as eventmanager.ClassTier)
      const classTierChanged = nextTier !== profile.classTier

      if (classTierChanged) {
        await updateAdminUserClass(profile.id, nextTier, authHeader)
        // Refresh profile state with the new class tier
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
    <AdminLayout
      title="User Profile Detail"
      subtitle={profile ? `Displaying identity parameters and system privileges for user: ${profile.name}` : `Displaying administrative system attributes for user: ${userId}`}
    >
      <div className="slds-grid slds-wrap slds-gutters">
        <div className="slds-col slds-size_1-of-1 slds-medium-size_2-of-3 slds-m-bottom_medium">
          <article className="slds-card" style={{ border: '1px solid #dddbda' }}>
            <div className="slds-card__header slds-grid">
              <header className="slds-media slds-media_center slds-has-flexi-truncate">
                <div className="slds-media__body">
                  <h2 className="slds-card__header-title">
                    <span className="slds-card__header-link slds-truncate font-semibold" style={{ fontWeight: 'bold' }}>
                      {isEditing ? 'Configure Competitor Account Parameters' : 'Competitor Account Details'}
                    </span>
                  </h2>
                </div>
              </header>
            </div>

            <div className="slds-card__body slds-card__body_inner" style={{ padding: '1.5rem' }}>
              {error && (
                <div className="slds-m-bottom_medium">
                  <AlertBanner variant="error">{error}</AlertBanner>
                </div>
              )}
              {success && (
                <div className="slds-m-bottom_medium">
                  <AlertBanner variant="success">{success}</AlertBanner>
                </div>
              )}

              {loading ? (
                <div className="slds-align_absolute-center slds-p-around_large text-slate-500" style={{ textAlign: 'center' }}>
                  <p>Loading user profile...</p>
                </div>
              ) : profile ? (
                <div>
                  {isEditing ? (
                    /* EDIT MODE FORM */
                    <div>
                      <div className="slds-box slds-theme_shade" style={{ background: '#f8fafc', border: '1px solid #dddbda', borderRadius: '4px', padding: '1.5rem', marginBottom: '1.5rem' }}>
                        <div className="slds-grid slds-wrap slds-gutters">
                          {/* Full Name Input */}
                          <div className="slds-col slds-size_1-of-1 slds-medium-size_1-of-2 slds-m-bottom_small">
                            <label className="slds-form-element__label text-slate-500" style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 'bold' }} htmlFor="user-name">Full Name</label>
                            <div className="slds-form-element__control slds-m-top_xx-small">
                              <input
                                id="user-name"
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="slds-input font-bold"
                                style={{ padding: '6px 12px', border: '1px solid #dddbda', borderRadius: '4px', width: '100%', fontWeight: 'bold' }}
                              />
                            </div>
                          </div>

                          {/* Slug Input */}
                          <div className="slds-col slds-size_1-of-1 slds-medium-size_1-of-2 slds-m-bottom_small">
                            <label className="slds-form-element__label text-slate-500" style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 'bold' }} htmlFor="user-slug">Slug (Handle)</label>
                            <div className="slds-form-element__control slds-m-top_xx-small">
                              <input
                                id="user-slug"
                                type="text"
                                value={slug}
                                onChange={(e) => setSlug(e.target.value)}
                                className="slds-input"
                                style={{ padding: '6px 12px', border: '1px solid #dddbda', borderRadius: '4px', width: '100%' }}
                                placeholder="e.g. thunder"
                              />
                            </div>
                            <div className="slds-m-top_xx-small text-slate-400" style={{ fontSize: '11px' }}>
                              Slugs must be between 4 and 24 lowercase alphanumeric characters.
                            </div>
                          </div>

                          {/* VRChat Username Input */}
                          <div className="slds-col slds-size_1-of-1 slds-medium-size_1-of-2 slds-m-bottom_small">
                            <label className="slds-form-element__label text-slate-500" style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 'bold' }} htmlFor="vrchat-username">VRChat Username</label>
                            <div className="slds-form-element__control slds-m-top_xx-small">
                              <input
                                id="vrchat-username"
                                type="text"
                                value={vrchatUsername}
                                onChange={(e) => setVrchatUsername(e.target.value)}
                                className="slds-input"
                                style={{ padding: '6px 12px', border: '1px solid #dddbda', borderRadius: '4px', width: '100%' }}
                                placeholder="e.g. VRC_User"
                              />
                            </div>
                          </div>

                          {/* Profile Image Input */}
                          <div className="slds-col slds-size_1-of-1 slds-medium-size_1-of-2 slds-m-bottom_small">
                            <label className="slds-form-element__label text-slate-500" style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 'bold' }} htmlFor="profile-image">Profile Image URL</label>
                            <div className="slds-form-element__control slds-m-top_xx-small">
                              <input
                                id="profile-image"
                                type="text"
                                value={image}
                                onChange={(e) => setImage(e.target.value)}
                                className="slds-input"
                                style={{ padding: '6px 12px', border: '1px solid #dddbda', borderRadius: '4px', width: '100%' }}
                                placeholder="e.g. https://example.com/image.png"
                              />
                            </div>
                          </div>

                          {/* Skill Class Tier Dropdown Selector */}
                          <div className="slds-col slds-size_1-of-1 slds-medium-size_1-of-2 slds-m-bottom_small">
                            <label className="slds-form-element__label text-slate-500" style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 'bold' }} htmlFor="skill-class-tier">Skill Class Tier</label>
                            <div className="slds-form-element__control slds-m-top_xx-small">
                              <select
                                id="skill-class-tier"
                                value={classTier || ''}
                                onChange={(e) => setClassTier(e.target.value)}
                                className="slds-select"
                                style={{ padding: '6px 12px', border: '1px solid #dddbda', borderRadius: '4px', width: '100%' }}
                              >
                                <option value="">None (Default)</option>
                                <option value="G3">G3</option>
                                <option value="G2">G2</option>
                                <option value="G1">G1</option>
                              </select>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Biography Input Field */}
                      <div className="slds-m-bottom_large">
                        <label className="slds-form-element__label text-slate-500" style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 'bold' }} htmlFor="biography">Biography</label>
                        <div className="slds-form-element__control slds-m-top_xx-small">
                          <textarea
                            id="biography"
                            value={biography}
                            onChange={(e) => setBiography(e.target.value)}
                            className="slds-textarea"
                            style={{ padding: '10px', borderRadius: '4px', border: '1px solid #dddbda', minHeight: '80px', width: '100%' }}
                            placeholder="Tell us about yourself..."
                          />
                        </div>
                      </div>

                      {/* Career Overview Input Field */}
                      <div className="slds-m-bottom_large">
                        <label className="slds-form-element__label text-slate-500" style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 'bold' }} htmlFor="career-overview">Career Overview</label>
                        <div className="slds-form-element__control slds-m-top_xx-small">
                          <textarea
                            id="career-overview"
                            value={careerOverview}
                            onChange={(e) => setCareerOverview(e.target.value)}
                            className="slds-textarea"
                            style={{ padding: '10px', borderRadius: '4px', border: '1px solid #dddbda', minHeight: '80px', width: '100%' }}
                            placeholder="Detail your competitive history and highlights..."
                          />
                        </div>
                      </div>

                      {/* Form Actions */}
                      <div className="slds-m-bottom_large" style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                        <button
                          type="button"
                          onClick={handleCancelEdit}
                          disabled={saving}
                          className="slds-button slds-button_neutral"
                          style={{ padding: '8px 24px', fontSize: '14px', borderRadius: '4px' }}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={handleSaveChanges}
                          disabled={saving || loading}
                          className="slds-button slds-button_brand"
                          style={{ padding: '8px 24px', fontSize: '14px', borderRadius: '4px' }}
                        >
                          {saving ? 'Saving...' : 'Save Changes'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* DETAILS VIEW (READ-focused) */
                    <div>
                      <div className="slds-box slds-theme_shade" style={{ background: '#f8fafc', border: '1px solid #dddbda', borderRadius: '4px', padding: '1.5rem', marginBottom: '1.5rem' }}>
                        <div className="slds-grid slds-wrap slds-gutters" style={{ alignItems: 'center' }}>
                          {/* Avatar Column */}
                          <div className="slds-col slds-size_1-of-1 slds-medium-size_1-of-4 slds-m-bottom_small slds-align_absolute-center" style={{ display: 'flex', justifyContent: 'center' }}>
                            {profile.image ? (
                              <img
                                src={profile.image}
                                alt={`${profile.name}'s Avatar`}
                                style={{
                                  width: '110px',
                                  height: '110px',
                                  borderRadius: '50%',
                                  objectFit: 'cover',
                                  border: '2px solid #dddbda',
                                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                                }}
                              />
                            ) : (
                              <div
                                style={{
                                  width: '110px',
                                  height: '110px',
                                  borderRadius: '50%',
                                  background: '#cbd5e1',
                                  color: '#475569',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: '2.5rem',
                                  fontWeight: 'bold',
                                  border: '2px solid #dddbda',
                                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                                }}
                              >
                                {profile.name ? profile.name.charAt(0).toUpperCase() : 'U'}
                              </div>
                            )}
                          </div>

                          {/* Details Column */}
                          <div className="slds-col slds-size_1-of-1 slds-medium-size_3-of-4">
                            <div className="slds-grid slds-wrap slds-gutters">
                              {/* Full Name */}
                              <div className="slds-col slds-size_1-of-1 slds-medium-size_1-of-2 slds-m-bottom_small">
                                <p className="slds-text-title text-slate-500" style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 'bold' }}>Full Name</p>
                                <p className="text-lg font-bold text-slate-800" style={{ fontWeight: 'bold' }}>{profile.name || 'None'}</p>
                              </div>

                              {/* Slug */}
                              <div className="slds-col slds-size_1-of-1 slds-medium-size_1-of-2 slds-m-bottom_small">
                                <p className="slds-text-title text-slate-500" style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 'bold' }}>Slug (Handle)</p>
                                <p className="text-md font-semibold text-slate-700">@{profile.slug || 'None'}</p>
                              </div>

                              {/* VRChat Username */}
                              <div className="slds-col slds-size_1-of-1 slds-medium-size_1-of-2 slds-m-bottom_small">
                                <p className="slds-text-title text-slate-500" style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 'bold' }}>VRChat Username</p>
                                <p className="text-md text-slate-700">{profile.vrchatUsername || 'None'}</p>
                              </div>

                              {/* Skill Class Tier */}
                              <div className="slds-col slds-size_1-of-1 slds-medium-size_1-of-2 slds-m-bottom_small">
                                <p className="slds-text-title text-slate-500" style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 'bold' }}>Skill Class Tier</p>
                                <span className="slds-badge slds-theme_light" style={{ padding: '2px 8px', borderRadius: '4px', display: 'inline-block', marginTop: '2px' }}>
                                  {profile.classTier || 'None / PRE_OP'}
                                </span>
                              </div>

                              {/* System Site Role */}
                              <div className="slds-col slds-size_1-of-1 slds-medium-size_1-of-2 slds-m-bottom_small">
                                <p className="slds-text-title text-slate-500" style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 'bold' }}>System Site Role</p>
                                <span className={`slds-badge ${profile.siteRole === 'SITE_ADMIN' ? 'slds-theme_success' : 'slds-theme_light'}`} style={{ padding: '2px 8px', borderRadius: '4px', display: 'inline-block', marginTop: '2px' }}>
                                  {profile.siteRole}
                                </span>
                              </div>

                              {/* Active Competitor ID */}
                              <div className="slds-col slds-size_1-of-1 slds-medium-size_1-of-2 slds-m-bottom_small">
                                <p className="slds-text-title text-slate-500" style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 'bold' }}>Active Competitor ID</p>
                                <code className="text-xs" style={{ fontSize: '12px', display: 'block', padding: '4px 0' }}>{profile.id}</code>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Biography */}
                      <div className="slds-m-bottom_large">
                        <p className="slds-text-title text-slate-500" style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 'bold' }}>Biography</p>
                        <div className="slds-m-top_xx-small" style={{ whiteSpace: 'pre-wrap', background: '#f8fafc', padding: '12px', borderRadius: '4px', border: '1px solid #dddbda', minHeight: '60px', color: '#334155' }}>
                          {profile.biography ? profile.biography : <span className="text-slate-400 italic">No biography registered.</span>}
                        </div>
                      </div>

                      {/* Career Overview */}
                      <div className="slds-m-bottom_large">
                        <p className="slds-text-title text-slate-500" style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 'bold' }}>Career Overview</p>
                        <div className="slds-m-top_xx-small" style={{ whiteSpace: 'pre-wrap', background: '#f8fafc', padding: '12px', borderRadius: '4px', border: '1px solid #dddbda', minHeight: '60px', color: '#334155' }}>
                          {profile.careerOverview ? profile.careerOverview : <span className="text-slate-400 italic">No career overview highlights registered.</span>}
                        </div>
                      </div>

                      {/* Trigger Edit Button */}
                      <div className="slds-m-bottom_large" style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <button
                          type="button"
                          onClick={() => setIsEditing(true)}
                          className="slds-button slds-button_brand"
                          style={{ padding: '8px 24px', fontSize: '14px', borderRadius: '4px' }}
                        >
                          Edit Profile Details
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Active Team Affiliations */}
                  <div className="slds-m-bottom_large" style={{ borderTop: '1px solid #dddbda', paddingTop: '1.5rem' }}>
                    <p className="slds-text-title text-slate-500 slds-m-bottom_small" style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 'bold' }}>Active Team Affiliations</p>
                    {profile.teams && profile.teams.length > 0 ? (
                      <div className="slds-grid slds-wrap" style={{ gap: '8px' }}>
                        {profile.teams.map((t) => (
                          <div key={t.organizationId} className="slds-box" style={{ background: '#f3f2f1', padding: '8px 12px', borderRadius: '4px', border: '1px solid #dddbda' }}>
                            <p className="font-bold" style={{ fontWeight: 'bold' }}>{t.name}</p>
                            <p className="text-slate-500 text-xs" style={{ fontSize: '11px' }}>Role: <span className="font-semibold">{t.role}</span></p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-slate-500 text-sm">This competitor is not currently affiliated with any registered organization teams.</p>
                    )}
                  </div>

                  {/* SITE ROLE ADJUSTMENT ACTIONS */}
                  {userId !== session?.user.id ? (
                    <div style={{ borderTop: '1px solid #dddbda', paddingTop: '1.5rem' }}>
                      <p className="slds-text-title text-slate-500 slds-m-bottom_small" style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 'bold' }}>Adjust Global Authorization Privilege</p>
                      <div className="slds-grid slds-wrap" style={{ display: 'flex', gap: '8px' }}>
                        <button
                          type="button"
                          onClick={() => adjustSiteRole('SITE_ADMIN')}
                          disabled={updatingRole || profile.siteRole === 'SITE_ADMIN'}
                          className="slds-button slds-button_success"
                          style={{ padding: '6px 16px', background: '#2e7d32', color: '#fff' }}
                        >
                          Grant SITE_ADMIN Privilege
                        </button>
                        <button
                          type="button"
                          onClick={() => adjustSiteRole('USER')}
                          disabled={updatingRole || profile.siteRole === 'USER'}
                          className="slds-button slds-button_destructive"
                          style={{ padding: '6px 16px', background: '#d32f2f', color: '#fff' }}
                        >
                          Revoke to USER Privilege
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="slds-box slds-theme_shade" style={{ background: '#fffbeb', border: '1px solid #fef3c7', borderRadius: '4px', padding: '1rem', marginTop: '1.5rem' }}>
                      <p className="text-amber-800 text-sm font-semibold" style={{ color: '#92400e', fontWeight: 'bold' }}>
                        Self-Privilege Safeguard
                      </p>
                      <p className="text-amber-700 text-xs slds-m-top_xx-small" style={{ color: '#b45309' }}>
                        You cannot modify your own global siteRole privileges while active in your current session.
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="slds-align_absolute-center text-slate-500 slds-p-around_large" style={{ textAlign: 'center', border: '1px dashed #dddbda', borderRadius: '4px' }}>
                  <p>Profile was not found or is empty.</p>
                </div>
              )}
            </div>

            <footer className="slds-card__footer" style={{ borderTop: '1px solid #f3f2f1', padding: '1rem' }}>
              <Link to="/admin/users" className="slds-button slds-button_neutral" style={{ textDecoration: 'none' }}>
                Back to Competitor Directory
              </Link>
            </footer>
          </article>
        </div>
      </div>
    </AdminLayout>
  )
}

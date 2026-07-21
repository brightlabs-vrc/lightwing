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

  // Local state for editable fields
  const [name, setName] = useState('')
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
      setProfile(loaded)
      setName(loaded.name || '')
      setBiography(loaded.biography || '')
      setCareerOverview(loaded.careerOverview || '')
      setVrchatUsername(loaded.vrchatUsername || '')
      setImage(loaded.image || '')
      setClassTier(loaded.classTier || '')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load competitor profile')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadProfile()
  }, [userId])

  async function handleSaveChanges() {
    if (!profile || !authHeader) {
      setError('System authentication is required.')
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
        biography !== (profile.biography || '') ||
        careerOverview !== (profile.careerOverview || '') ||
        vrchatUsername !== (profile.vrchatUsername || '') ||
        image !== (profile.image || '')

      if (profileChanged) {
        currentProfile = await updateAdminUserProfile(
          profile.id,
          {
            name,
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
      subtitle={`Displaying and configuring administrative system attributes for user: ${userId}`}
    >
      <div className="slds-grid slds-wrap slds-gutters">
        <div className="slds-col slds-size_1-of-1 slds-medium-size_2-of-3 slds-m-bottom_medium">
          <article className="slds-card" style={{ border: '1px solid #dddbda' }}>
            <div className="slds-card__header slds-grid">
              <header className="slds-media slds-media_center slds-has-flexi-truncate">
                <div className="slds-media__body">
                  <h2 className="slds-card__header-title">
                    <span className="slds-card__header-link slds-truncate font-semibold" style={{ fontWeight: 'bold' }}>
                      Competitor Account Parameters
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

                      {/* System Site Role Read-only */}
                      <div className="slds-col slds-size_1-of-1 slds-medium-size_1-of-2 slds-m-bottom_small">
                        <p className="slds-text-title text-slate-500 slds-m-bottom_xx-small" style={{ fontSize: '11px', textTransform: 'uppercase' }}>System Site Role</p>
                        <span className={`slds-badge ${profile.siteRole === 'SITE_ADMIN' ? 'slds-theme_success' : 'slds-theme_light'}`} style={{ padding: '2px 10px', borderRadius: '4px', background: profile.siteRole === 'SITE_ADMIN' ? '#2e7d32' : '#e0e0e0', color: profile.siteRole === 'SITE_ADMIN' ? '#fff' : '#000' }}>
                          {profile.siteRole}
                        </span>
                      </div>

                      {/* Active Competitor ID Read-only */}
                      <div className="slds-col slds-size_1-of-1 slds-medium-size_1-of-2 slds-m-bottom_small">
                        <p className="slds-text-title text-slate-500" style={{ fontSize: '11px', textTransform: 'uppercase' }}>Active Competitor ID</p>
                        <code className="text-xs" style={{ fontSize: '12px', display: 'block', padding: '6px 0' }}>{profile.id}</code>
                      </div>

                      {/* Skill Class Tier Dropdown Selector */}
                      <div className="slds-col slds-size_1-of-1 slds-medium-size_1-of-2 slds-m-bottom_small">
                        <label className="slds-form-element__label text-slate-500" style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 'bold' }} htmlFor="skill-class-tier">Skill Class Tier</label>
                        <div className="slds-form-element__control slds-m-top_xx-small">
                          <select
                            id="skill-class-tier"
                            value={classTier}
                            onChange={(e) => setClassTier(e.target.value)}
                            className="slds-select"
                            style={{ padding: '6px 12px', border: '1px solid #dddbda', borderRadius: '4px', width: '100%' }}
                          >
                            <option value="">None / PRE_OP (Default)</option>
                            <option value="PRE_OP">PRE_OP</option>
                            <option value="OP">OP</option>
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

                  {/* Save Changes Button */}
                  <div className="slds-m-bottom_large" style={{ display: 'flex', justifyContent: 'flex-end' }}>
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

                  <div className="slds-m-bottom_large">
                    <p className="slds-text-title text-slate-500 slds-m-bottom_small" style={{ fontSize: '11px', textTransform: 'uppercase' }}>Active Team Affiliations</p>
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

                  {userId !== session?.user.id ? (
                    <div style={{ borderTop: '1px solid #dddbda', paddingTop: '1.5rem' }}>
                      <p className="slds-text-title text-slate-500 slds-m-bottom_small" style={{ fontSize: '11px', textTransform: 'uppercase' }}>Adjust Global Authorization Privilege</p>
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
                    <div className="slds-box slds-theme_shade" style={{ background: '#fffbeb', border: '1px solid #fef3c7', borderRadius: '4px', padding: '1rem' }}>
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

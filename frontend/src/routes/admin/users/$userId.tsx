import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../../hooks/useAuth'
import { requireSiteAdmin } from '../../../lib/auth-guard'
import {
  getAdminUserProfile,
  updateAdminUserSiteRole,
  updateAdminUserMetadata,
} from '../../../lib/admin-api'
import { AdminLayout } from '../-AdminLayout'
import { AlertBanner } from '../../../components/AlertBanner'
import { LoadingBox } from '../../../components/LoadingBox'
import { SldsIcon } from '../../../components/SldsIcon'
import type { auth } from '../../../lib/client'

export const Route = createFileRoute('/admin/users/$userId')({
  beforeLoad: async ({ location }) => {
    await requireSiteAdmin(location)
  },
  component: AdminUserDetailPage,
})

// Skill class tiers (mirrors eventmanager/classtier.ts on the backend).
const CLASS_TIERS: { value: Exclude<auth.UserProfile['classTier'], null>; label: string }[] = [
  { value: 'PRE_OP', label: 'PRE-OP' },
  { value: 'OP', label: 'OP' },
  { value: 'G3', label: 'G3' },
  { value: 'G2', label: 'G2' },
  { value: 'G1', label: 'G1' },
]

type ActiveTab = 'profile' | 'permissions'

export function AdminUserDetailPage() {
  const { userId } = Route.useParams()
  const { session } = useAuth()
  const isCurrentUser = session?.user.id === userId

  const [profile, setProfile] = useState<auth.UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [updatingRole, setUpdatingRole] = useState(false)
  const [savingMeta, setSavingMeta] = useState(false)
  const [activeTab, setActiveTab] = useState<ActiveTab>('profile')

  const [form, setForm] = useState({
    name: '',
    biography: '',
    careerOverview: '',
    classTier: '' as auth.UserProfile['classTier'] | '',
  })

  const authHeader = useMemo(() => {
    const token = session?.session.token
    return token ? `Bearer ${token}` : null
  }, [session?.session.token])

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    setSuccess(null)
    getAdminUserProfile(userId)
      .then((loaded) => {
        if (!active) return
        setProfile(loaded)
        setForm({
          name: loaded.name ?? '',
          biography: loaded.biography ?? '',
          careerOverview: loaded.careerOverview ?? '',
          classTier: loaded.classTier ?? '',
        })
      })
      .catch((cause) => {
        if (!active) return
        setProfile(null)
        setError(cause instanceof Error ? cause.message : 'Unable to fetch user profile')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [userId])

  async function setSiteRole(siteRole: auth.SiteRoleName) {
    if (!profile || !authHeader) {
      setError('Missing auth session token. Re-authenticate from /auth and try again.')
      setSuccess(null)
      return
    }
    setUpdatingRole(true)
    setError(null)
    setSuccess(null)
    try {
      const updated = await updateAdminUserSiteRole(profile.id, siteRole, authHeader)
      setProfile(updated)
      setSuccess(`Successfully updated ${updated.name}'s role to ${siteRole}.`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to update site role')
    } finally {
      setUpdatingRole(false)
    }
  }

  async function saveMetadata() {
    if (!profile || !authHeader) {
      setError('Missing auth session token. Re-authenticate from /auth and try again.')
      setSuccess(null)
      return
    }
    setSavingMeta(true)
    setError(null)
    setSuccess(null)
    try {
      const updated = await updateAdminUserMetadata(
        profile.id,
        {
          name: form.name.trim() || undefined,
          biography: form.biography.trim() || null,
          careerOverview: form.careerOverview.trim() || null,
          classTier: form.classTier === '' ? null : form.classTier,
        },
        authHeader,
      )
      setProfile(updated)
      setForm({
        name: updated.name ?? '',
        biography: updated.biography ?? '',
        careerOverview: updated.careerOverview ?? '',
        classTier: updated.classTier ?? '',
      })
      setSuccess(`Successfully updated ${updated.name}'s profile metadata.`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to update profile metadata')
    } finally {
      setSavingMeta(false)
    }
  }

  return (
    <AdminLayout
      title="User Account Management"
      subtitle="Edit user metadata and manage administrative permissions for platform competitors."
      actions={
        <Link
          to="/admin/users"
          className="slds-button slds-button_neutral"
          style={{ padding: '4px 12px', fontSize: '12px' }}
        >
          <SldsIcon category="utility" name="back" size={14} /> Back to Users
        </Link>
      }
    >
      {error && !loading && !profile && (
        <AlertBanner variant="error">{error}</AlertBanner>
      )}

      {loading ? (
        <LoadingBox message={`Loading profile for ${userId}...`} />
      ) : profile ? (
        <div className="slds-box bg-white" style={{ background: '#ffffff', borderRadius: '4px', border: '1px solid #dddbda', padding: '1.5rem' }}>
          <div className="slds-grid slds-grid_align-spread slds-m-bottom_large" style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #dddbda', paddingBottom: '1rem' }}>
            <div>
              <h2 className="slds-text-heading_medium font-bold text-slate-900" style={{ fontSize: '1.35rem', fontWeight: 'bold' }}>{profile.name}</h2>
              <p className="slds-text-body_small text-slate-500">ID: {profile.id}</p>
            </div>

            {/* Site role controller */}
            <div className="slds-form-element" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <label className="slds-form-element__label font-bold text-slate-700" style={{ fontWeight: 'bold', margin: 0 }}>Site Role:</label>
              <div className="slds-form-element__control">
                <select
                  disabled={updatingRole}
                  value={profile.siteRole}
                  onChange={(e) => void setSiteRole(e.target.value as auth.SiteRoleName)}
                  className="slds-select"
                  style={{ minWidth: '130px', padding: '4px 28px 4px 12px', border: '1px solid #dddbda', borderRadius: '4px' }}
                >
                  <option value="USER">USER</option>
                  <option value="SITE_ADMIN">SITE_ADMIN</option>
                </select>
              </div>
            </div>
          </div>

          {success && (
            <AlertBanner variant="success">{success}</AlertBanner>
          )}
          {error && (
            <AlertBanner variant="error">{error}</AlertBanner>
          )}

          {/* SLDS Tabs Secondary Context Header */}
          <div className="slds-tabs_default slds-m-bottom_large">
            <ul className="slds-tabs_default__nav" role="tablist" style={{ display: 'flex', borderBottom: '1px solid #dddbda', listStyle: 'none', margin: 0, padding: 0 }}>
              <li className={`slds-tabs_default__item ${activeTab === 'profile' ? 'slds-is-active' : ''}`} role="presentation" style={{ borderBottom: activeTab === 'profile' ? '3px solid #0176d3' : 'none' }}>
                <button
                  className="slds-tabs_default__link"
                  type="button"
                  onClick={() => setActiveTab('profile')}
                  style={{ border: 'none', background: 'transparent', padding: '12px 16px', cursor: 'pointer', fontWeight: activeTab === 'profile' ? 'bold' : 'normal', color: activeTab === 'profile' ? '#0176d3' : '#180505' }}
                >
                  Profile Metadata
                </button>
              </li>
              <li className={`slds-tabs_default__item ${activeTab === 'permissions' ? 'slds-is-active' : ''}`} role="presentation" style={{ borderBottom: activeTab === 'permissions' ? '3px solid #0176d3' : 'none' }}>
                <button
                  className="slds-tabs_default__link"
                  type="button"
                  onClick={() => setActiveTab('permissions')}
                  style={{ border: 'none', background: 'transparent', padding: '12px 16px', cursor: 'pointer', fontWeight: activeTab === 'permissions' ? 'bold' : 'normal', color: activeTab === 'permissions' ? '#0176d3' : '#180505' }}
                >
                  Permissions
                </button>
              </li>
            </ul>

            {/* Tab 1: Profile Metadata */}
            {activeTab === 'profile' && (
              <div className="slds-tabs_default__content slds-show slds-p-vertical_medium" style={{ paddingTop: '1.5rem' }}>
                <div className="slds-grid slds-wrap slds-gutters slds-m-bottom_large">
                  <div className="slds-col slds-size_1-of-1 slds-medium-size_1-of-2 slds-m-bottom_small">
                    <p className="slds-text-title_caps text-slate-500 font-bold" style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 'bold' }}>Email Address</p>
                    <p className="slds-text-body_regular text-slate-800 slds-m-top_xx-small">{profile.email}</p>
                  </div>
                  <div className="slds-col slds-size_1-of-1 slds-medium-size_1-of-2 slds-m-bottom_small">
                    <p className="slds-text-title_caps text-slate-500 font-bold" style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 'bold' }}>Skill Class Tier</p>
                    <p className="slds-text-body_regular text-slate-800 slds-m-top_xx-small">
                      <strong>{profile.classTier ?? 'PRE_OP (Default)'}</strong>
                    </p>
                  </div>
                </div>

                <div className="slds-form slds-m-bottom_large">
                  <div className="slds-form-element slds-m-bottom_medium">
                    <label className="slds-form-element__label font-bold text-slate-700" style={{ fontWeight: 'bold' }} htmlFor="detail-name">
                      Full Name
                    </label>
                    <div className="slds-form-element__control">
                      <input
                        id="detail-name"
                        value={form.name}
                        onChange={(evt) => setForm((f) => ({ ...f, name: evt.target.value }))}
                        className="slds-input"
                        style={{ padding: '6px 12px', border: '1px solid #dddbda', borderRadius: '4px' }}
                      />
                    </div>
                  </div>

                  <div className="slds-form-element slds-m-bottom_medium">
                    <label className="slds-form-element__label font-bold text-slate-700" style={{ fontWeight: 'bold' }} htmlFor="detail-classtier">
                      Skill Class Tier
                    </label>
                    <div className="slds-form-element__control">
                      <select
                        id="detail-classtier"
                        value={form.classTier ?? ''}
                        onChange={(evt) =>
                          setForm((f) => ({
                            ...f,
                            classTier: (evt.target.value || '') as auth.UserProfile['classTier'] | '',
                          }))
                        }
                        className="slds-select"
                        style={{ padding: '6px 12px', border: '1px solid #dddbda', borderRadius: '4px' }}
                      >
                        <option value="">PRE-OP (Default)</option>
                        {CLASS_TIERS.map((tier) => (
                          <option key={tier.value} value={tier.value}>
                            {tier.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="slds-form-element slds-m-bottom_medium">
                    <label className="slds-form-element__label font-bold text-slate-700" style={{ fontWeight: 'bold' }} htmlFor="detail-bio">
                      Career Biography
                    </label>
                    <div className="slds-form-element__control">
                      <textarea
                        id="detail-bio"
                        value={form.biography}
                        onChange={(evt) => setForm((f) => ({ ...f, biography: evt.target.value }))}
                        rows={3}
                        className="slds-textarea"
                        style={{ padding: '6px 12px', border: '1px solid #dddbda', borderRadius: '4px' }}
                      />
                    </div>
                  </div>

                  <div className="slds-form-element slds-m-bottom_medium">
                    <label className="slds-form-element__label font-bold text-slate-700" style={{ fontWeight: 'bold' }} htmlFor="detail-career">
                      Career Overview
                    </label>
                    <div className="slds-form-element__control">
                      <textarea
                        id="detail-career"
                        value={form.careerOverview}
                        onChange={(evt) => setForm((f) => ({ ...f, careerOverview: evt.target.value }))}
                        rows={2}
                        className="slds-textarea"
                        style={{ padding: '6px 12px', border: '1px solid #dddbda', borderRadius: '4px' }}
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      void saveMetadata()
                    }}
                    disabled={savingMeta}
                    className="slds-button slds-button_brand"
                    style={{ padding: '6px 20px' }}
                  >
                    {savingMeta ? 'Saving...' : 'Save Profile Changes'}
                  </button>
                </div>
              </div>
            )}

            {/* Tab 2: Permissions */}
            {activeTab === 'permissions' && (
              <div className="slds-tabs_default__content slds-show slds-p-vertical_medium" style={{ paddingTop: '1.5rem' }}>
                <div className="slds-grid slds-wrap slds-gutters slds-m-bottom_large">
                  <div className="slds-col slds-size_1-of-1 slds-medium-size_1-of-2 slds-m-bottom_small">
                    <p className="slds-text-title_caps text-slate-500 font-bold" style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 'bold' }}>Current Site Role</p>
                    <p className="slds-text-body_regular text-slate-800 slds-m-top_xx-small">
                      <span className={`slds-badge ${profile.siteRole === 'SITE_ADMIN' ? 'slds-theme_success' : 'slds-theme_light'}`} style={{ padding: '2px 8px', borderRadius: '4px', background: profile.siteRole === 'SITE_ADMIN' ? '#2e7d32' : '#e0e0e0', color: profile.siteRole === 'SITE_ADMIN' ? '#fff' : '#000' }}>
                        {profile.siteRole}
                      </span>
                    </p>
                  </div>
                  <div className="slds-col slds-size_1-of-1 slds-medium-size_1-of-2 slds-m-bottom_small">
                    <p className="slds-text-title_caps text-slate-500 font-bold" style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 'bold' }}>Team Affiliations</p>
                    <p className="slds-text-body_regular text-slate-800 slds-m-top_xx-small">
                      {profile.teams.length > 0
                        ? profile.teams.map((team) => team.name).join(', ')
                        : 'No team memberships.'}
                    </p>
                  </div>
                </div>

                <h3 className="slds-text-heading_small font-bold slds-m-bottom_small text-slate-900" style={{ fontWeight: 'bold', borderBottom: '1px solid #f3f2f1', paddingBottom: '4px' }}>
                  Adjust Administrative Access
                </h3>
                <p className="slds-text-body_small text-slate-500 slds-m-bottom_medium" style={{ fontSize: '12px' }}>
                  Grant or revoke the global SITE_ADMIN privilege. Administrators have platform-wide control over all data and short-circuit every scoped permission check.
                </p>
                <div className="slds-grid slds-wrap" style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => {
                      void setSiteRole('SITE_ADMIN')
                    }}
                    disabled={updatingRole || profile.siteRole === 'SITE_ADMIN'}
                    className="slds-button slds-button_success"
                    style={{ padding: '6px 16px', background: '#2e7d32', color: '#fff' }}
                  >
                    Grant SITE_ADMIN
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      void setSiteRole('USER')
                    }}
                    disabled={updatingRole || profile.siteRole === 'USER'}
                    className="slds-button slds-button_destructive"
                    style={{ padding: '6px 16px', background: '#d32f2f', color: '#fff' }}
                  >
                    Revoke to USER
                  </button>
                </div>

                {isCurrentUser && (
                  <p className="slds-text-color_weak slds-m-top_medium text-xs">
                    You are editing your own administrator account. Revoking your own SITE_ADMIN access will lock you out of this panel.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="slds-align_absolute-center text-slate-500 slds-p-around_large" style={{ textAlign: 'center', border: '1px dashed #dddbda', borderRadius: '4px' }}>
          <p>{error ?? 'User not found.'}</p>
          <p className="slds-m-top_small text-xs">Return to the <Link to="/admin/users" className="text-blue-600 hover:underline font-bold">User Directory</Link> to search again.</p>
        </div>
      )}
    </AdminLayout>
  )
}

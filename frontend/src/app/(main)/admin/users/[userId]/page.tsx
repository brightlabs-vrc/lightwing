'use client'

import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { AdminLayout } from '@/components/Admin/AdminLayout'
import { AlertBanner } from '@/components/AlertBanner'
import { Heading, Label, Button, TextInput, FormControl, Spinner, Dialog, Select } from '@primer/react'
import type { auth, eventmanager } from '@/lib/client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { use } from 'react'
import { getAdminUserProfile, updateAdminUserSiteRole, updateAdminUserClass } from '@/lib/admin-api'
import { useQueryClient } from '@tanstack/react-query'

export default function AdminUserDetailPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = use(params)
  const router = useRouter()
  const queryClient = useQueryClient()
  const { session, loading: authLoading } = useAuth()
  const authHeader = useMemo(() => session?.session.token ? "Bearer " + session.session.token : null, [session?.session.token])

  // Client-side admin check
  useEffect(() => {
    if (!authLoading && session?.user.siteRole !== 'SITE_ADMIN') {
      router.replace('/auth?redirect=' + encodeURIComponent('/admin/users/' + userId) + '&error=forbidden')
    }
  }, [session, authLoading, router, userId])

  const [user, setUser] = useState<auth.UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [editingRole, setEditingRole] = useState(false)
  const [editingTier, setEditingTier] = useState(false)
  const [newRole, setNewRole] = useState<auth.SiteRoleName>('USER')
  const [newTier, setNewTier] = useState<eventmanager.ClassTier | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    async function loadUser() {
      try {
        const u = await getAdminUserProfile(userId)
        setUser(u)
        setNewRole(u.siteRole)
        setNewTier(u.classTier ?? null)
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Unable to load user')
      } finally {
        setLoading(false)
      }
    }
    void loadUser()
  }, [userId])

  const handleSaveRole = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!authHeader) return
    setSaving(true)
    setSaveError(null)
    try {
      await updateAdminUserSiteRole(userId, newRole, authHeader)
      setEditingRole(false)
      setSaving(false)
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      const updated = await getAdminUserProfile(userId)
      setUser(updated)
    } catch (cause) {
      setSaveError(cause instanceof Error ? cause.message : 'Failed to update role')
      setSaving(false)
    }
  }

  const handleSaveTier = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!authHeader) return
    setSaving(true)
    setSaveError(null)
    try {
      await updateAdminUserClass(userId, newTier, authHeader)
      setEditingTier(false)
      setSaving(false)
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      const updated = await getAdminUserProfile(userId)
      setUser(updated)
    } catch (cause) {
      setSaveError(cause instanceof Error ? cause.message : 'Failed to update tier')
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <Spinner size="large" />
      </div>
    )
  }

  if (error && !user) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <AlertBanner variant="error">{error}</AlertBanner>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <AdminLayout>
      <Heading as="h1" style={{ fontSize: '24px', marginBottom: '1rem' }}>User Details</Heading>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <Heading as="h2" style={{ fontSize: '20px', margin: 0 }}>{user.name}</Heading>
      </div>

      {error && (
        <AlertBanner variant="error">{error}</AlertBanner>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '2rem' }}>
        <div>
          <span style={{ fontWeight: '600', marginBottom: '0.5rem', display: 'block' }}>User ID</span>
          <span style={{ color: 'var(--color-fg-muted)' }}>{user.id}</span>
        </div>
        <div>
          <span style={{ fontWeight: '600', marginBottom: '0.5rem', display: 'block' }}>Email</span>
          <span style={{ color: 'var(--color-fg-muted)' }}>{user.email}</span>
        </div>
        {user.vrchatUsername && (
          <div>
            <span style={{ fontWeight: '600', marginBottom: '0.5rem', display: 'block' }}>VRChat</span>
            <span style={{ color: 'var(--color-fg-muted)' }}>@{user.vrchatUsername}</span>
          </div>
        )}
        <div>
          <span style={{ fontWeight: '600', marginBottom: '0.5rem', display: 'block' }}>Class Tier</span>
          <span style={{ color: 'var(--color-fg-muted)' }}>{user.classTier ?? 'Not set'}</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
        <div>
          <Heading as="h3" style={{ fontSize: '16px', margin: 0 }}>Site Role</Heading>
          <div style={{ marginTop: '0.5rem' }}>
            <Label variant={user.siteRole === 'SITE_ADMIN' ? 'success' : 'default'}>
              {user.siteRole}
            </Label>
          </div>
          <div style={{ marginTop: '0.5rem' }}>
            <Button variant="primary" size="small" onClick={() => setEditingRole(true)}>Edit Role</Button>
          </div>
          {editingRole && (
            <Dialog onClose={() => setEditingRole(false)} title="Edit Site Role">
              <form onSubmit={handleSaveRole}>
                <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {saveError && <AlertBanner variant="error">{saveError}</AlertBanner>}
                  <FormControl>
                    <FormControl.Label style={{ fontWeight: 'bold' }}>Site Role</FormControl.Label>
                    <Select
                      value={newRole}
                      onChange={(e) => setNewRole(e.target.value as auth.SiteRoleName)}
                    >
                      <option value="USER">User</option>
                      <option value="SITE_ADMIN">Site Admin</option>
                    </Select>
                  </FormControl>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', padding: '1rem 1.5rem', borderTop: '1px solid var(--color-border-default)', backgroundColor: 'var(--color-canvas-subtle)' }}>
                  <Button type="button" onClick={() => setEditingRole(false)}>Cancel</Button>
                  <Button type="submit" variant="primary" disabled={saving}>{saving ? 'Saving...' : 'Save Role'}</Button>
                </div>
              </form>
            </Dialog>
          )}
        </div>

        <div>
          <Heading as="h3" style={{ fontSize: '16px', margin: 0 }}>Class Tier</Heading>
          <div style={{ marginTop: '0.5rem' }}>
            <Label variant="default">
              {user.classTier ?? 'Not set'}
            </Label>
          </div>
          <div style={{ marginTop: '0.5rem' }}>
            <Button variant="primary" size="small" onClick={() => setEditingTier(true)}>Edit Tier</Button>
          </div>
          {editingTier && (
            <Dialog onClose={() => setEditingTier(false)} title="Edit Class Tier">
              <form onSubmit={handleSaveTier}>
                <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {saveError && <AlertBanner variant="error">{saveError}</AlertBanner>}
                  <FormControl>
                    <FormControl.Label style={{ fontWeight: 'bold' }}>Class Tier</FormControl.Label>
                    <Select
                      value={newTier ?? ''}
                      onChange={(e) => setNewTier(e.target.value === '' ? null : (e.target.value as eventmanager.ClassTier))}
                    >
                      <option value="OP">OP</option>
                      <option value="PRE_OP">PRE_OP</option>
                      <option value="G3">G3</option>
                      <option value="G2">G2</option>
                      <option value="G1">G1</option>
                      <option value="">None</option>
                    </Select>
                  </FormControl>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', padding: '1rem 1.5rem', borderTop: '1px solid var(--color-border-default)', backgroundColor: 'var(--color-canvas-subtle)' }}>
                  <Button type="button" onClick={() => setEditingTier(false)}>Cancel</Button>
                  <Button type="submit" variant="primary" disabled={saving}>{saving ? 'Saving...' : 'Save Tier'}</Button>
                </div>
              </form>
            </Dialog>
          )}
        </div>
      </div>
    </AdminLayout>
  )
}

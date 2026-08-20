'use client'

import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { AdminLayout } from '@/components/Admin/AdminLayout'
import { AlertBanner } from '@/components/AlertBanner'
import { PaginationBar } from '@/components/Pagination'
import { UserLink } from '@/components/UserLink'
import { Heading, Label, Button, TextInput, FormControl, Spinner, Dialog, Select } from '@primer/react'
import type { teammanager } from '@/lib/client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { use } from 'react'
import { listAdminTeamMembers, getAdminTeam, updateAdminTeam, addAdminTeamMember, updateAdminTeamMemberRole, removeAdminTeamMember } from '@/lib/admin-api'
import { useQueryClient } from '@tanstack/react-query'

export default function AdminTeamDetailPage({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = use(params)
  const router = useRouter()
  const queryClient = useQueryClient()
  const { session, loading: authLoading } = useAuth()
  const authHeader = useMemo(() => session?.session.token ? "Bearer " + session.session.token : null, [session?.session.token])

  // Client-side admin check
  useEffect(() => {
    if (!authLoading && session?.user.siteRole !== 'SITE_ADMIN') {
      router.replace('/auth?redirect=' + encodeURIComponent('/admin/teams/' + teamId) + '&error=forbidden')
    }
  }, [session, authLoading, router, teamId])

  const [team, setTeam] = useState<teammanager.Team | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [members, setMembers] = useState<Array<{ userId: string; name: string; slug: string | null; role: string }>>([])
  const [totalMembers, setTotalMembers] = useState(0)
  const [memberPage, setMemberPage] = useState(1)
  const [memberPageSize, setMemberPageSize] = useState(10)
  const [memberSearch, setMemberSearch] = useState('')

  const [isParamsModalOpen, setIsParamsModalOpen] = useState(false)
  const [teamName, setTeamName] = useState('')
  const [teamSlug, setTeamSlug] = useState('')
  const [teamLogo, setTeamLogo] = useState('')
  const [saving, setSaving] = useState(false)

  const [newMemberRole, setNewMemberRole] = useState<'MEMBER' | 'ADMIN'>('MEMBER')
  const [addMemberUserId, setAddMemberUserId] = useState('')
  const [addMemberError, setAddMemberError] = useState<string | null>(null)
  const [isAddMemberModalOpen, setIsAddMemberModalOpen] = useState(false)

  useEffect(() => {
    async function loadTeam() {
      try {
        const t = await getAdminTeam(teamId)
        setTeam(t)
        setTeamName(t.name)
        setTeamSlug(t.slug)
        setTeamLogo(t.logo ?? '')
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Unable to load team')
      } finally {
        setLoading(false)
      }
    }
    void loadTeam()
  }, [teamId])

  const fetchMembers = useCallback(async () => {
    setError(null)
    try {
      const offset = (memberPage - 1) * memberPageSize
      const result = await listAdminTeamMembers(teamId, memberSearch, memberPageSize, offset)
      setMembers(result.members)
      setTotalMembers(result.total)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load team members')
    }
  }, [teamId, memberSearch, memberPage, memberPageSize])

  useEffect(() => { void fetchMembers() }, [fetchMembers])

  async function handleSaveParams(e: React.FormEvent) {
    e.preventDefault()
    if (!authHeader || !team) return
    setSaving(true)
    try {
      await updateAdminTeam(teamId, {
        name: teamName.trim() || team.name,
        slug: teamSlug.trim() || team.slug,
        logo: teamLogo.trim() || null,
      }, authHeader)
      setTeam(prev => prev ? {
        ...prev,
        name: teamName.trim() || prev.name,
        slug: teamSlug.trim() || prev.slug,
        logo: teamLogo.trim() || null,
      } : prev)
      setIsParamsModalOpen(false)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to update team')
    } finally {
      setSaving(false)
    }
  }

  async function handleAddMember(e: React.FormEvent) {
    e.preventDefault()
    if (!authHeader || !team) return
    setAddMemberError(null)
    try {
      // Find user by ID or slug
      const userId = addMemberUserId.startsWith('@')
        ? addMemberUserId.slice(1)
        : addMemberUserId

      await addAdminTeamMember(teamId, { userId }, authHeader)
      await fetchMembers()
      setIsAddMemberModalOpen(false)
      setAddMemberUserId('')
    } catch (cause) {
      setAddMemberError(cause instanceof Error ? cause.message : 'Unable to add member')
    }
  }

  async function handleUpdateMemberRole(memberUserId: string, newRole: string) {
    if (!authHeader || !team) return
    try {
      await updateAdminTeamMemberRole(teamId, memberUserId, newRole, authHeader)
      await fetchMembers()
      setTeam(prev => prev ? ({
        ...prev,
        members: prev.members.map(m => m.userId === memberUserId ? { ...m, role: newRole } : m)
      }) : prev)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to update member role')
    }
  }

  async function handleRemoveMember(memberUserId: string) {
    if (!authHeader || !team) return
    try {
      await removeAdminTeamMember(teamId, memberUserId, authHeader)
      await fetchMembers()
      setTeam(prev => prev ? ({
        ...prev,
        members: prev.members.filter(m => m.userId !== memberUserId)
      }) : prev)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to remove member')
    }
  }

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <Spinner size="large" />
      </div>
    )
  }

  if (error && !team) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <AlertBanner variant="error">{error}</AlertBanner>
      </div>
    )
  }

  if (!team) {
    return null
  }

  return (
    <AdminLayout>
      <Heading as="h1" style={{ fontSize: '24px', marginBottom: '1rem' }}>Team Details</Heading>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <Heading as="h2" style={{ fontSize: '20px', margin: 0 }}>{team.name}</Heading>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <Button variant="default" onClick={() => setIsParamsModalOpen(true)}>Edit Team</Button>
        </div>
      </div>

      {error && (
        <AlertBanner variant="error">{error}</AlertBanner>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '2rem' }}>
        <div>
          <span style={{ fontWeight: '600', marginBottom: '0.5rem', display: 'block' }}>Team ID</span>
          <span style={{ color: 'var(--color-fg-muted)' }}>{team.id}</span>
        </div>
        <div>
          <span style={{ fontWeight: '600', marginBottom: '0.5rem', display: 'block' }}>Slug</span>
          <span style={{ color: 'var(--color-fg-muted)' }}>@{team.slug}</span>
        </div>
        {team.logo && (
          <div>
            <span style={{ fontWeight: '600', marginBottom: '0.5rem', display: 'block' }}>Logo</span>
            <img src={team.logo} alt="Team logo" style={{ maxWidth: '200px', borderRadius: '4px' }} />
          </div>
        )}
        <div>
          <span style={{ fontWeight: '600', marginBottom: '0.5rem', display: 'block' }}>Members</span>
          <span style={{ color: 'var(--color-fg-muted)' }}>{team.members.length}</span>
        </div>
      </div>

      <div style={{ marginTop: '2rem' }}>
        <Heading as="h2" style={{ fontSize: '18px', marginBottom: '1rem' }}>Members</Heading>
        {members.length === 0 ? (
          <span style={{ color: 'var(--color-fg-muted)' }}>No members yet</span>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {members.map((member) => (
              <div key={member.userId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', border: '1px solid var(--color-border-default)', borderRadius: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  {member.name}
                  <span style={{ fontSize: '12px', color: 'var(--color-fg-muted)' }}>{member.role}</span>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <Button size="small" variant="default" onClick={() => handleUpdateMemberRole(member.userId, 'ADMIN')}>Admin</Button>
                  <Button size="small" variant="default" onClick={() => handleUpdateMemberRole(member.userId, 'MEMBER')}>Member</Button>
                  <Button size="small" variant="danger" onClick={() => handleRemoveMember(member.userId)}>Remove</Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {isParamsModalOpen && (
        <Dialog onClose={() => setIsParamsModalOpen(false)} title="Edit Team">
          <form onSubmit={handleSaveParams}>
            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <FormControl>
                <FormControl.Label style={{ fontWeight: 'bold' }}>Team Name</FormControl.Label>
                <TextInput
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                />
              </FormControl>
              <FormControl>
                <FormControl.Label style={{ fontWeight: 'bold' }}>Slug</FormControl.Label>
                <TextInput
                  value={teamSlug}
                  onChange={(e) => setTeamSlug(e.target.value)}
                />
              </FormControl>
              <FormControl>
                <FormControl.Label style={{ fontWeight: 'bold' }}>Logo URL</FormControl.Label>
                <TextInput
                  value={teamLogo}
                  onChange={(e) => setTeamLogo(e.target.value)}
                />
              </FormControl>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', padding: '1rem 1.5rem', borderTop: '1px solid var(--color-border-default)', backgroundColor: 'var(--color-canvas-subtle)' }}>
              <Button type="button" onClick={() => setIsParamsModalOpen(false)}>Cancel</Button>
              <Button type="submit" variant="primary" disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
            </div>
          </form>
        </Dialog>
      )}

      {isAddMemberModalOpen && (
        <Dialog onClose={() => setIsAddMemberModalOpen(false)} title="Add Team Member">
          <form onSubmit={handleAddMember}>
            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {addMemberError && <AlertBanner variant="error">{addMemberError}</AlertBanner>}
              <FormControl>
                <FormControl.Label style={{ fontWeight: 'bold' }}>User ID or Slug</FormControl.Label>
                <TextInput
                  value={addMemberUserId}
                  onChange={(e) => setAddMemberUserId(e.target.value)}
                  placeholder="e.g. user123 or @user123"
                />
              </FormControl>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', padding: '1rem 1.5rem', borderTop: '1px solid var(--color-border-default)', backgroundColor: 'var(--color-canvas-subtle)' }}>
              <Button type="button" onClick={() => setIsAddMemberModalOpen(false)}>Cancel</Button>
              <Button type="submit" variant="primary">Add Member</Button>
            </div>
          </form>
        </Dialog>
      )}
    </AdminLayout>
  )
}

import React, { useState, useEffect } from 'react'
import { Link, useNavigate, useRouterState } from '@tanstack/react-router'
import { useAuth } from '../../hooks/useAuth'
import { listApprovedOrganizations } from '../../lib/admin-api'
import {
  PixelContainer,
  PixelStack,
  PixelButton,
} from '@pxlkit/ui-kit'
import { UserHeaderDropdown } from '../../components/UserHeaderDropdown'

interface ManagementLayoutProps {
  children: React.ReactNode
}

export function ManagementLayout({ children }: ManagementLayoutProps) {
  const { session, signOutUser } = useAuth()
  const navigate = useNavigate()
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const isManagePage = pathname.startsWith('/teams/manage/')
  const currentTeamId = pathname.split('/teams/manage/')[1]?.split('/')[0]

  const [userManagedOrgs, setUserManagedOrgs] = useState<Array<{ id: string; name: string; slug: string }>>([])
  const [loadingOrgs, setLoadingOrgs] = useState(true)

  useEffect(() => {
    async function fetchOrgs() {
      try {
        const list: Array<{ id: string; name: string; slug: string }> = []
        if (session?.user?.teams) {
          for (const t of session.user.teams) {
            if (!list.some((x) => x.id === t.organizationId)) {
              list.push({ id: t.organizationId, name: t.name, slug: t.slug })
            }
          }
        }
        const orgsRes = await listApprovedOrganizations()
        for (const ao of orgsRes.organizations || []) {
          if (!list.some((x) => x.id === ao.id)) {
            list.push({ id: ao.id, name: ao.name, slug: ao.slug })
          }
        }
        setUserManagedOrgs(list)
      } catch {
      } finally {
        setLoadingOrgs(false)
      }
    }
    void fetchOrgs()
  }, [session])

  return (
    <div className="min-h-screen bg-retro-bg text-retro-text font-sans">
      <header className="border-b-2 border-retro-border-strong bg-retro-surface py-1">
        <PixelContainer maxWidth="full" padding="none" className="site-header-container px-3 sm:px-4">
          <PixelStack direction="row" gap={3} align="center" justify="between" wrap className="site-header-inner">
            <PixelStack direction="row" gap={3} align="center" wrap className="min-w-0">
              <Link to="/" className="flex items-center gap-2 shrink-0">
                <img src="/favicon.png" alt="Lightwing" className="w-6 h-6" />
                <span className="font-pixel text-xs sm:text-sm font-bold text-retro-text tracking-wide">
                  MANAGEMENT CONSOLE
                </span>
              </Link>

              {isManagePage && (loadingOrgs || userManagedOrgs.length > 0) && (
                <div className="flex items-center gap-2 sm:pl-4 sm:border-l-2 sm:border-retro-border min-w-0">
                  <span className="font-pixel text-[10px] sm:text-xs text-retro-muted font-bold shrink-0">
                    ENTITY:
                  </span>
                  {loadingOrgs ? (
                    <div className="h-7 w-40 sm:w-52 bg-retro-bg border-2 border-retro-border rounded animate-pulse" />
                  ) : (
                    <select
                      value={currentTeamId || ''}
                      onChange={(e) => {
                        const targetId = e.target.value
                        if (targetId && targetId !== currentTeamId) {
                          void navigate({ to: '/teams/manage/$id', params: { id: targetId } })
                        }
                      }}
                      className="px-2.5 py-1 bg-retro-bg border-2 border-retro-border rounded font-pixel text-[11px] sm:text-xs text-retro-primary font-bold focus:outline-none focus:border-retro-primary cursor-pointer max-w-[190px] sm:max-w-xs truncate"
                    >
                      {currentTeamId && !userManagedOrgs.some((o) => o.id === currentTeamId) && (
                        <option value={currentTeamId}>CURRENT ({currentTeamId})</option>
                      )}
                      {userManagedOrgs.map((org) => (
                        <option key={org.id} value={org.id}>
                          {org.name.toUpperCase()} (@{org.slug})
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}
            </PixelStack>

            <PixelStack direction="row" gap={2} align="center" wrap>
              <PixelButton asChild variant="ghost" tone="neutral" size="sm">
                <Link to="/">PUBLIC SITE</Link>
              </PixelButton>
              {session?.user?.siteRole === 'SITE_ADMIN' && (
                <PixelButton asChild variant="soft" tone="gold" size="sm">
                  <Link to="/admin">ADMIN PANEL</Link>
                </PixelButton>
              )}
              {session && (
                <UserHeaderDropdown
                  session={session}
                  signOutUser={signOutUser}
                />
              )}
            </PixelStack>
          </PixelStack>
        </PixelContainer>
      </header>

      <main className="w-full px-3 sm:px-6 py-4 sm:py-8">
        {children}
      </main>
    </div>
  )
}
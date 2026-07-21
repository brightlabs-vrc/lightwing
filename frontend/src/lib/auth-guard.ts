import { redirect } from '@tanstack/react-router'
import { getAuthSession, type AuthSession } from './auth'

export interface RouteLocation {
  href?: string
  pathname: string
  search?: string | Record<string, unknown>
  hash?: string
}

export function buildRedirectPath(location: RouteLocation): string {
  if (location.href?.startsWith('/')) {
    return location.href
  }

  const searchPart = typeof location.search === 'string' ? location.search : ''
  return `${location.pathname}${searchPart}${location.hash ?? ''}`
}

/**
 * Ensures the caller is authenticated. If not, redirects to the unified
 * `/auth` route, preserving the current location so auth can return there.
 */
export async function requireAuth(location: RouteLocation): Promise<AuthSession> {
  const authSession = await getAuthSession()

  if (!authSession) {
    throw redirect({
      to: '/auth',
      search: {
        redirect: buildRedirectPath(location),
      },
    })
  }

  if (!authSession.user.vrchatUsername && location.pathname !== '/onboarding') {
    throw redirect({
      to: '/onboarding',
    })
  }

  return authSession
}

/**
 * Ensures the caller is an authenticated SITE_ADMIN. Non-admins are sent to
 * `/auth` with a `forbidden` error so the page can explain the situation.
 */
export async function requireSiteAdmin(location: RouteLocation): Promise<AuthSession> {
  const authSession = await requireAuth(location)

  if (authSession.user.siteRole !== 'SITE_ADMIN') {
    throw redirect({
      to: '/auth',
      search: {
        redirect: buildRedirectPath(location),
        error: 'forbidden',
      },
    })
  }

  return authSession
}

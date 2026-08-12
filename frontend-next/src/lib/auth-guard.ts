import { redirect } from 'next/navigation'
import { getAuthSession, type AuthSession } from './auth'

export interface RouteLocation {
  href?: string
  pathname: string
  search?: string | Record<string, unknown>
  hash?: string
}

/**
 * Builds a RouteLocation from the current Next.js request.
 * Use this in server components to get the current pathname.
 */
export function getCurrentLocation(): RouteLocation {
  // In server components, we can't access router directly.
  // This is a fallback - the actual pathname should be passed in.
  return { pathname: '/' }
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
export async function requireAuth(location?: RouteLocation): Promise<AuthSession> {
  const authSession = await getAuthSession()
  const loc = location ?? { pathname: '/' }

  if (!authSession) {
    redirect(
      `/auth?redirect=${encodeURIComponent(buildRedirectPath(loc))}`,
    )
  }

  if (!authSession.user.vrchatUsername && loc.pathname !== '/onboarding') {
    redirect('/onboarding')
  }

  return authSession
}

/**
 * Ensures the caller is an authenticated SITE_ADMIN. Non-admins are sent to
 * `/auth` with a `forbidden` error so the page can explain the situation.
 */
export async function requireSiteAdmin(location?: RouteLocation): Promise<AuthSession> {
  const authSession = await requireAuth(location)
  const loc = location ?? { pathname: '/' }

  if (authSession.user.siteRole !== 'SITE_ADMIN') {
    redirect(
      `/auth?redirect=${encodeURIComponent(buildRedirectPath(loc))}&error=forbidden`,
    )
  }

  return authSession
}

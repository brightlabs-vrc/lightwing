import { redirect } from '@tanstack/react-router'
import { getAuthSession } from './auth'

interface RouteLocation {
  href?: string
  pathname: string
  search?: string | Record<string, unknown>
  hash?: string
}

function buildRedirectPath(location: RouteLocation) {
  if (location.href?.startsWith('/')) {
    return location.href
  }

  const searchPart = typeof location.search === 'string' ? location.search : ''
  return `${location.pathname}${searchPart}${location.hash ?? ''}`
}

export async function requireSiteAdmin(location: RouteLocation) {
  const authSession = await getAuthSession()

  if (!authSession) {
    throw redirect({
      to: '/auth',
      search: {
        redirect: buildRedirectPath(location),
      },
    })
  }

  if (authSession.user.siteRole !== 'SITE_ADMIN') {
    throw redirect({
      to: '/auth',
      search: {
        redirect: '/',
        error: 'forbidden',
      },
    })
  }

  return authSession
}

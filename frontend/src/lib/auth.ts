import { Local } from './client'
import { MOCK_MODE } from './mock-mode'

export type SiteRole = 'USER' | 'SITE_ADMIN'

export interface AuthUser {
  id: string
  name: string
  email: string
  image?: string | null
  siteRole?: SiteRole
}

export interface AuthSession {
  session: {
    token: string
    expiresAt: string
  }
  user: AuthUser
}

interface SocialSignInResponse {
  url?: string
  redirect: boolean
}

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? Local
const MOCK_SESSION_KEY = 'lightwing:mock:session'

const defaultMockSession: AuthSession = {
  session: {
    token: 'mock-session-token',
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  },
  user: {
    id: 'mock-admin-1',
    name: 'Mock Admin',
    email: 'mock-admin@lightwing.local',
    image: null,
    siteRole: 'SITE_ADMIN',
  },
}

function authUrl(path: string) {
  return `${API_BASE_URL}/api/auth${path}`
}

function sanitizeRedirectPath(raw: string | undefined): string {
  if (!raw || !raw.startsWith('/')) {
    return '/'
  }
  return raw
}

function readMockSession(): AuthSession | null {
  const raw = globalThis.localStorage.getItem(MOCK_SESSION_KEY)
  if (!raw) {
    return null
  }

  try {
    return JSON.parse(raw) as AuthSession
  } catch {
    return null
  }
}

function writeMockSession(session: AuthSession | null) {
  if (!session) {
    globalThis.localStorage.removeItem(MOCK_SESSION_KEY)
    return
  }

  globalThis.localStorage.setItem(MOCK_SESSION_KEY, JSON.stringify(session))
}

export async function getAuthSession(): Promise<AuthSession | null> {
  if (MOCK_MODE) {
    return readMockSession()
  }

  const response = await fetch(authUrl('/get-session'), {
    method: 'GET',
    credentials: 'include',
  })

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      return null
    }
    throw new Error(`Failed to load auth session (${response.status})`)
  }

  const payload = (await response.json()) as AuthSession | null
  return payload
}

export async function signInWithDiscord(redirectPath?: string): Promise<void> {
  if (MOCK_MODE) {
    const callbackPath = sanitizeRedirectPath(redirectPath)
    writeMockSession(defaultMockSession)
    window.location.assign(callbackPath)
    return
  }

  const callbackPath = sanitizeRedirectPath(redirectPath)
  const callbackURL = `${window.location.origin}${callbackPath}`

  const response = await fetch(authUrl('/sign-in/social'), {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      provider: 'discord',
      callbackURL,
      errorCallbackURL: `${window.location.origin}/auth?error=oauth`,
    }),
  })

  if (!response.ok) {
    throw new Error(`Failed to start Discord sign-in (${response.status})`)
  }

  const payload = (await response.json()) as SocialSignInResponse
  if (!payload.url) {
    throw new Error('Discord sign-in response did not include a redirect URL')
  }

  window.location.assign(payload.url)
}

export async function signOut(): Promise<void> {
  if (MOCK_MODE) {
    writeMockSession(null)
    return
  }

  const response = await fetch(authUrl('/sign-out'), {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`Failed to sign out (${response.status})`)
  }
}

export function isMockMode() {
  return MOCK_MODE
}

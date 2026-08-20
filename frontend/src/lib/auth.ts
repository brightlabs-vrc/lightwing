import { writeStoredSessionToken } from './api'
import { MOCK_MODE } from './mock-mode'

export type SiteRole = 'USER' | 'SITE_ADMIN'

export interface AuthUser {
  id: string
  name: string
  email: string
  image?: string | null
  siteRole?: SiteRole
  vrchatUsername?: string | null
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
    vrchatUsername: null,
  },
}

/**
 * Auth endpoints are same-origin and reverse-proxied to the Encore backend.
 * This keeps session cookies first-party (required for reliable login on
 * Safari and under third-party cookie restrictions).
 */
function authUrl(path: string) {
  // Always same-origin in the browser — the frontend host proxies /api/auth
  // to the Encore API. SSR / tests: fall back to configured API if needed.
  if (typeof window !== "undefined") {
    return `/api/auth${path}`
  }
  // Server-side: construct absolute URL for fetch
  // In production, the frontend host proxies /api/auth to Encore
  // For local dev/testing without proxy, we need the actual API URL
  const baseUrl = process.env.VITE_API_BASE_URL || 'http://localhost:4000'
  return `${baseUrl}/api/auth${path}`
}

function sanitizeRedirectPath(raw: string | undefined): string {
  if (!raw || !raw.startsWith('/')) {
    return '/'
  }
  return raw
}

function readMockSession(): AuthSession | null {
  const raw = globalThis.localStorage?.getItem(MOCK_SESSION_KEY)
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
    globalThis.localStorage?.removeItem(MOCK_SESSION_KEY)
    return
  }

  globalThis.localStorage?.setItem(MOCK_SESSION_KEY, JSON.stringify(session))
}

export async function getAuthSession(): Promise<AuthSession | null> {
  // Check for mock session cookie (server-side, for Playwright tests)
  try {
    const { cookies } = await import('next/headers')
    const cookieStore = await cookies()
    const mockSessionCookie = cookieStore.get('lightwing:mock:session')?.value
    const mockModeCookie = cookieStore.get('lightwing:mock:mode')?.value

    console.log('getAuthSession: mockModeCookie =', mockModeCookie, 'mockSessionCookie =', mockSessionCookie ? 'present' : 'none')

    if (mockModeCookie === 'true') {
      console.log('getAuthSession: mock mode enabled via cookie')
      if (mockSessionCookie) {
        try {
          const session = JSON.parse(mockSessionCookie) as AuthSession
          if (session.session?.token) {
            return session
          }
        } catch (e) {
          console.error('getAuthSession: failed to parse mock session:', e)
        }
      }
      console.log('getAuthSession: returning defaultMockSession')
      return defaultMockSession
    }

    if (mockSessionCookie) {
      try {
        const session = JSON.parse(mockSessionCookie) as AuthSession
        if (session.session?.token) {
          return session
        }
      } catch {
        // ignore
      }
    }
  } catch (err) {
    console.error('getAuthSession: cookie check error:', err)
  }

  // Check for mock mode (client-side check for client components)
  if (MOCK_MODE) {
    console.log('getAuthSession: MOCK_MODE is true, reading from localStorage')
    return readMockSession()
  }
  console.log('getAuthSession: MOCK_MODE is false, fetching real session')

  // Try to get the real session
  try {
    const response = await fetch(authUrl('/get-session'), {
      method: 'GET',
      credentials: 'include',
      signal: AbortSignal.timeout(5000),
    })

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        writeStoredSessionToken(null)
        return null
      }
      throw new Error(`Failed to load auth session (${response.status})`)
    }

    const payload = (await response.json()) as AuthSession | null
    if (payload?.session?.token) {
      writeStoredSessionToken(payload.session.token)
    } else {
      writeStoredSessionToken(null)
    }
    return payload
  } catch (err) {
    console.error('getAuthSession: fetch error:', err)
    // Return null on fetch failure instead of throwing
    return null
  }
}

export async function signInWithDiscord(redirectPath?: string): Promise<void> {
  if (MOCK_MODE) {
    const callbackPath = sanitizeRedirectPath(redirectPath)
    writeMockSession(defaultMockSession)
    window.location.assign(callbackPath)
    return
  }

  const callbackPath = sanitizeRedirectPath(redirectPath)
  // Route the OAuth callback back through /auth so the unified auth page can
  // verify the session and then return the user to where they were.
  const callbackURL = `${window.location.origin}/auth?redirect=${encodeURIComponent(callbackPath)}`

  const response = await fetch(authUrl('/sign-in/social'), {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      provider: 'discord',
      callbackURL,
      // Do NOT pre-bake an `error` param here. better-auth redirects back with
      // its own `?error=<real_code>&error_description=...` on failure (e.g.
      // `state_mismatch`); pre-baking `?error=oauth` shadowed that real code so
      // the auth page could never show what actually went wrong. Keep the
      // `redirect` so a successful return still continues to the right place.
      errorCallbackURL: `${window.location.origin}/auth?redirect=${encodeURIComponent(callbackPath)}`,
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

  writeStoredSessionToken(null)

  if (!response.ok) {
    throw new Error(`Failed to sign out (${response.status})`)
  }
}

export function isMockMode() {
  return MOCK_MODE
}

/**
 * Get the current session token for API calls.
 * Returns null if not authenticated or in mock mode without a session.
 */
export async function getSession(): Promise<AuthSession | null> {
  return getAuthSession()
}

/**
 * Server-side mock session reader for tests.
 * Reads mock session from cookies set by /test-setup route.
 * Only works in server components during testing.
 *
 * @internal
 */
export async function getMockSessionServerSide(): Promise<AuthSession | null> {
  try {
    const { cookies: cookiesImport } = await import('next/headers')
    const cookieStore = await cookiesImport()
    const cookieValue = cookieStore.get(MOCK_SESSION_KEY)?.value
    if (cookieValue) {
      try {
        return JSON.parse(cookieValue) as AuthSession
      } catch {
        return null
      }
    }
  } catch {
    // cookies() might not be available or might throw
  }
  return null
}

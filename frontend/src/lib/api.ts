import Client, { Local } from './client'

function resolveApiBaseUrl(): string {
  if (typeof window !== 'undefined') {
    // Browser: use the current origin so auth requests are same-origin
    // (proxied through Next.js /api/auth/* rewrites to Encore).
    const { hostname, origin } = window.location
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return Local
    }
    return origin
  }
  // Server-side (SSR): use configured Encore URL or default to local.
  const configured = (process.env.ENCORE_API_BASE_URL as string | undefined)?.trim()
  if (configured) {
    return configured
  }
  return Local
}

export const API_BASE_URL = resolveApiBaseUrl()

const SESSION_TOKEN_KEY = 'lightwing:session:token'

export function getStoredSessionToken(): string | null {
  if (typeof window === 'undefined' || !window.localStorage) {
    return null
  }
  return window.localStorage.getItem(SESSION_TOKEN_KEY)
}

export function writeStoredSessionToken(token: string | null) {
  if (typeof window === 'undefined' || !window.localStorage) {
    return
  }
  if (token) {
    window.localStorage.setItem(SESSION_TOKEN_KEY, token)
  } else {
    window.localStorage.removeItem(SESSION_TOKEN_KEY)
  }
}

export const appClient = new Client(API_BASE_URL, {
  auth: () => {
    const token = getStoredSessionToken()
    if (token) {
      return { authorization: `Bearer ${token}` }
    }
    return undefined
  }
})

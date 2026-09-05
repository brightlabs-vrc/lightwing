import Client, { Local } from './client'

function resolveApiBaseUrl(): string {
	const configuredBaseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim()
	if (configuredBaseUrl) {
		return configuredBaseUrl
	}

	if (typeof window !== 'undefined') {
		const { hostname, origin } = window.location
		if (hostname === 'localhost' || hostname === '127.0.0.1') {
			return Local
		}
		return origin
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

// Note: the Go-generated client has no `auth` ClientOptions hook, so every
// authenticated wrapper passes `Authorization` explicitly in its params.
export const appClient = new Client(API_BASE_URL)

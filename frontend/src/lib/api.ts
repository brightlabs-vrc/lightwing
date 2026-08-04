import Client, { Local } from './client'

function resolveApiBaseUrl(): string {
	const configuredBackendUrl = (import.meta.env.VITE_BACKEND_URL as string | undefined)?.trim()
	if (configuredBackendUrl) {
		return configuredBackendUrl
	}

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

export const appClient = new Client(API_BASE_URL, {
  auth: () => {
    const token = getStoredSessionToken()
    if (token) {
      return { authorization: `Bearer ${token}` }
    }
    return undefined
  }
})

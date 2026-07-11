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

export const appClient = new Client(API_BASE_URL)

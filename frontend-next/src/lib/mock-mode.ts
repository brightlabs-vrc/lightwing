/**
 * Determines if mock mode is enabled.
 * 
 * Checks in order:
 * 1. VITE_MOCK_MODE env var (build-time)
 * 2. ENABLE_MOCK_MODE env var (runtime, for server components)
 * 3. Browser: localhost hostname (dev server)
 * 4. Browser: window.__LIGHTWING_MOCK_MODE flag (Playwright tests)
 * 5. Server: lightwing:mock:session cookie (Playwright tests with /test-setup)
 */
export const MOCK_MODE =
  (process.env.VITE_MOCK_MODE as string | undefined) === 'true' ||
  (typeof window !== 'undefined' && window.location.hostname === 'localhost') ||
  process.env.ENABLE_MOCK_MODE === 'true' ||
  (typeof window !== 'undefined' && (window as MockWindow).__LIGHTWING_MOCK_MODE === true)

/**
 * Server-side check for mock mode.
 * Called from server components to determine if mock data should be used.
 * This checks for the presence of a mock session cookie set by /test-setup route.
 * 
 * @returns true if mock mode should be enabled for server components
 */
export async function isMockModeEnabledServerSide(): Promise<boolean> {
  // Check env var first (works in both contexts)
  if (process.env.ENABLE_MOCK_MODE === 'true') {
    return true
  }
  
  // Check for mock mode cookie OR mock session cookie (server-side, for Playwright tests)
  try {
    const { cookies } = await import('next/headers')
    const cookieStore = await cookies()
    const hasMockMode = cookieStore.get('lightwing:mock:mode')?.value === 'true'
    const hasMockSession = cookieStore.get('lightwing:mock:session')?.value !== undefined
    if (hasMockMode || hasMockSession) {
      return true
    }
  } catch {
    // cookies() might not be available in all contexts
  }

  return false
}

/**
 * Extended window type for mock mode testing
 */
declare global {
  interface MockWindow extends Window {
    __LIGHTWING_MOCK_MODE?: boolean
  }
}

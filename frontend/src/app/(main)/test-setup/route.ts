import { cookies } from 'next/headers'
import { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import type { AuthSession } from '../../../lib/auth'

/**
 * Test setup route for Playwright tests.
 * Sets up a mock session cookie that server components can read.
 * 
 * Usage in Playwright:
 *   await page.goto('/test-setup?mockAdmin=true')
 *   // Now server components will see the mock session
 */

const MOCK_SESSION_KEY = 'lightwing:mock:session'

const mockSession: AuthSession = {
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
    vrchatUsername: 'mockadmin',
  },
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const enableMock = searchParams.get('mockAdmin')

  if (enableMock === 'true') {
    const cookieStore = await cookies()
    cookieStore.set(MOCK_SESSION_KEY, JSON.stringify(mockSession), {
      httpOnly: false,
      secure: false,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 1 week
    })

    return NextResponse.json({
      success: true,
      message: 'Mock admin session cookie set',
    })
  }

  return NextResponse.json({
    success: false,
    message: 'Use ?mockAdmin=true to set mock session',
  })
}
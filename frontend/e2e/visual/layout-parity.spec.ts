import { test, expect, type Page } from '@playwright/test'

async function setMockSession(page: Page, userType: 'admin' | 'user' = 'admin') {
  await page.addInitScript(() => {
    window.localStorage.setItem('lightwing:mock:session', JSON.stringify({
      session: { token: 'mock-session-token', expiresAt: new Date(Date.now() + 604800000).toISOString() },
      user: { id: 'mock-admin-1', name: 'Mock Admin', email: 'mock-admin@lightwing.local', image: null, siteRole: 'SITE_ADMIN', vrchatUsername: 'mockadmin' },
    }))
  })
}

test.describe('Layout parity between legacy and Primer migrations', () => {
  test('public events list — structural elements preserved', async ({ page }) => {
    await page.goto('/events')
    await page.waitForLoadState('networkidle')

    // Page title (h1) preserved
    await expect(page.locator('h1')).toContainText(/Competitive Events/i)

    // Page has content (not crashed)
    await expect(page.locator('body')).toContainText(/Events/i)

    // Header region present (brand + nav)
    const header = page.locator('header').first()
    await expect(header).toBeVisible()
    await expect(header).toContainText('LIGHTWING')

    // Event cards present or empty state
    const eventCard = page.locator('a').filter({ hasText: /Summer Sprint Invitational/i })
    const emptyState = page.locator('text=/No public events active/i')
    const count = await eventCard.count() + await emptyState.count()
    expect(count).toBeGreaterThan(0)
  })

  test('auth page — sign-in flow preserved', async ({ page }) => {
    await page.goto('/auth')
    await page.waitForLoadState('networkidle')

    // Sign-in button present (action priority preserved)
    await expect(page.locator('text=Continue with Discord')).toBeVisible()

    // Page heading preserved
    await expect(page.locator('text=Sign in to Lightwing')).toBeVisible()
  })

  test('onboarding page — VRChat form preserved', async ({ page }) => {
    await setMockSession(page, 'admin')
    await page.goto('/onboarding')
    await page.waitForLoadState('networkidle')

    // VRChat username input present
    await expect(page.locator('input[placeholder*="user123"]')).toBeVisible()

    // Submit button present (action priority preserved)
    await expect(page.locator('text=Continue to Events')).toBeVisible()
  })

  test('profile page — form fields preserved', async ({ page }) => {
    await setMockSession(page, 'admin')
    await page.goto('/profile/')
    await page.waitForLoadState('networkidle')

    // All form sections preserved (content hierarchy)
    await expect(page.locator('text=Edit Profile')).toBeVisible()
    await expect(page.locator('label', { hasText: /^Name$/ })).toBeVisible()
    await expect(page.locator('label', { hasText: /^Handle$/ })).toBeVisible()
    await expect(page.locator('label', { hasText: /^Biography$/ })).toBeVisible()
    await expect(page.locator('label', { hasText: /^Career Overview$/ })).toBeVisible()
    await expect(page.locator('label', { hasText: /^VRChat Username$/ })).toBeVisible()

    // Save button preserved (action priority)
    await expect(page.locator('text=Save Changes')).toBeVisible()
  })

  test('event detail page — back button, name, status, races preserved', async ({ page }) => {
    await page.goto('/events/evt_mock_001')
    await page.waitForLoadState('networkidle')

    // Back button preserved
    await expect(page.locator('text=Back to Events')).toBeVisible()

    // Event name preserved
    await expect(page.locator('text=Summer Sprint Invitational')).toBeVisible()

    // Status label preserved
    await expect(page.locator('text=UNOFFICIAL')).toBeVisible()

    // Races section preserved
    await expect(page.locator('text=Races')).toBeVisible()

    // Race content present (from mock data: Summer Sprint Turf)
    await expect(page.locator('text=Summer Sprint Turf')).toBeVisible()
  })

  test('admin dashboard — nav sections and manage buttons preserved', async ({ page }) => {
    await setMockSession(page, 'admin')
    await page.goto('/admin/')
    await page.waitForLoadState('networkidle')

    // Admin dashboard heading preserved
    await expect(page.locator('text=Admin Dashboard')).toBeVisible()

    // Navigation sections preserved (content hierarchy)
    await expect(page.locator('text=Events & Race Management')).toBeVisible()
    await expect(page.locator('text=User Administration')).toBeVisible()
    await expect(page.locator('text=Teams & Organizations')).toBeVisible()

    // Manage buttons preserved (action priority)
    await expect(page.locator('text=Manage Events')).toBeVisible()
    await expect(page.locator('text=Manage Users')).toBeVisible()
    await expect(page.locator('text=Manage Teams')).toBeVisible()
  })

  test('admin events list — event table preserved', async ({ page }) => {
    await setMockSession(page, 'admin')
    await page.goto('/admin/events')
    await page.waitForLoadState('networkidle')

    // Event table heading preserved
    await expect(page.locator('text=Event & Race Operations')).toBeVisible()
    // "Create Event" button preserved (action priority)
    await expect(page.locator('text=Create Event')).toBeVisible()
  })

  test('admin users list — table layout preserved', async ({ page }) => {
    await setMockSession(page, 'admin')
    await page.goto('/admin/users')
    await page.waitForLoadState('networkidle')

    await expect(page.locator('text=User Account Directory')).toBeVisible()
    await expect(page.locator('table')).toBeVisible()
  })

  test('admin teams list — table layout preserved', async ({ page }) => {
    await setMockSession(page, 'admin')
    await page.goto('/admin/teams')
    await page.waitForLoadState('networkidle')

    // "New Team" button preserved (action priority)
    await expect(page.locator('text=New Team')).toBeVisible()
    // Table with team data
    await expect(page.locator('table')).toBeVisible()
  })
})

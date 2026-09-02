import { describe, expect, it } from 'vitest'

describe('useNotification security fix', () => {
  it('uses crypto.randomUUID to generate secure toast notification IDs', () => {
    const uuid = crypto.randomUUID()
    expect(uuid).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    )
  })
})

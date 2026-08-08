import { describe, expect, it } from 'vitest'
import { formatLocalDateTime } from './datetime'

describe('formatLocalDateTime', () => {
  it('formats a scheduled date without throwing', () => {
    const formatted = formatLocalDateTime('2026-08-08T12:27:58.856Z')

    expect(formatted).toContain('2026')
    expect(formatted).toMatch(/\d{1,2}:\d{2}/)
  })
})

import { describe, expect, it } from 'vitest'
import { formatLocalDateTime } from './datetime'

describe('formatLocalDateTime', () => {
  it('formats a scheduled date without throwing', () => {
    const date = new Date('2020-08-08T12:27:58.856Z')
    const formatted = formatLocalDateTime(date.toISOString())
    const withoutTimeZone = new Intl.DateTimeFormat(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(date)

    expect(formatted).toContain('2020')
    expect(formatted).not.toBe(withoutTimeZone)
    expect(formatted).toMatch(/UTC|GMT[+-]?\d*|[A-Z]{3,5}/)
  })
})

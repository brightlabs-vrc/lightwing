import { describe, expect, it } from 'vitest'
import { formatLocalDateTime } from './datetime'

describe('formatLocalDateTime', () => {
  it('formats a scheduled date without throwing', () => {
    const iso = '2020-08-08T12:27:58.856Z'
    const formatted = formatLocalDateTime(iso)
    const expected = new Intl.DateTimeFormat(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short',
    }).format(new Date(iso))

    expect(formatted).toBe(expected)
  })
})

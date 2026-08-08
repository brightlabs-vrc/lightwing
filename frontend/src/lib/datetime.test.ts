import { describe, expect, it } from 'vitest'
import { formatLocalDateTime } from './datetime'

describe('formatLocalDateTime', () => {
  it('formats a scheduled date without throwing', () => {
    expect(formatLocalDateTime('2026-08-08T12:27:58.856Z')).toBeTruthy()
  })
})

import { describe, expect, it } from 'vitest'
import { sessionSecondsInRange } from './statsMath'
import { addDays, startOfDay } from '../utils/format'
import { resolveRange } from './statsService'

describe('sessionSecondsInRange', () => {
  it('returns full effective seconds when the session sits inside the bucket', () => {
    const start = startOfDay(Date.UTC(2026, 7, 13))
    const s = {
      startedAt: start + 8 * 3600_000,
      endedAt: start + 9 * 3600_000,
      effectiveSeconds: 1800,
    }
    expect(sessionSecondsInRange(s, start, addDays(start, 1))).toBe(1800)
  })

  it('splits a midnight-crossing session by wall-clock overlap', () => {
    const day = startOfDay(new Date(2026, 7, 13).getTime())
    const next = addDays(day, 1)
    const s = {
      startedAt: day + 23 * 3600_000,
      endedAt: next + 3600_000,
      effectiveSeconds: 7200,
    }
    expect(sessionSecondsInRange(s, day, next)).toBe(3600)
    expect(sessionSecondsInRange(s, next, addDays(next, 1))).toBe(3600)
  })

  it('returns 0 when there is no overlap', () => {
    const day = startOfDay(new Date(2026, 7, 13).getTime())
    const s = {
      startedAt: addDays(day, 2),
      endedAt: addDays(day, 2) + 1800_000,
      effectiveSeconds: 1800,
    }
    expect(sessionSecondsInRange(s, day, addDays(day, 1))).toBe(0)
  })
})

describe('resolveRange', () => {
  it('builds a one-day window for date', () => {
    const now = new Date(2026, 7, 13, 15, 0, 0).getTime()
    const date = resolveRange('date', now)
    expect(date.end - date.start).toBe(86_400_000)
    expect(startOfDay(date.start)).toBe(startOfDay(now))
    expect(date.end).toBe(addDays(startOfDay(now), 1))
  })

  it('swaps inverted custom dates to a safe one-day window', () => {
    const now = new Date(2026, 7, 13).getTime()
    const range = resolveRange('custom', now, addDays(now, 3), now)
    expect(range.end).toBeGreaterThan(range.start)
  })
})

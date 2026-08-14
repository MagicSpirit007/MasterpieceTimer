import { describe, expect, it } from 'vitest'
import type { ActiveSessionSnapshot } from '../types/models'
import {
  effectiveMs,
  isFinished,
  pausedMs,
  remainingMs,
  revealProgress,
} from './engine'

function snap(over: Partial<ActiveSessionSnapshot> = {}): ActiveSessionSnapshot {
  return {
    id: '1',
    projectId: 'p',
    artworkId: 'a',
    timerMode: 'countdown',
    plannedSeconds: 1500,
    startedAtUtc: 0,
    accumulatedEffectiveMs: 0,
    segmentStartedAtUtc: 0,
    accumulatedPausedMs: 0,
    pauseStartedAtUtc: null,
    state: 'running',
    notificationId: null,
    ...over,
  }
}

describe('revealProgress', () => {
  it('maps 0 / 50 / 100 percent of planned duration', () => {
    const s = snap({
      state: 'paused',
      segmentStartedAtUtc: null,
      pauseStartedAtUtc: 0,
    })
    expect(revealProgress({ ...s, accumulatedEffectiveMs: 0 }, 0)).toBe(0)
    expect(revealProgress({ ...s, accumulatedEffectiveMs: 750_000 }, 0)).toBe(0.5)
    expect(revealProgress({ ...s, accumulatedEffectiveMs: 1_500_000 }, 0)).toBe(1)
    expect(revealProgress({ ...s, accumulatedEffectiveMs: 2_000_000 }, 0)).toBe(1)
  })
})

describe('effectiveMs', () => {
  it('does not grow while paused', () => {
    const s = snap({
      state: 'paused',
      accumulatedEffectiveMs: 120_000,
      segmentStartedAtUtc: null,
      pauseStartedAtUtc: 200_000,
    })
    expect(effectiveMs(s, 200_000)).toBe(120_000)
    expect(effectiveMs(s, 260_000)).toBe(120_000)
  })

  it('adds only the current running segment', () => {
    const s = snap({
      state: 'running',
      accumulatedEffectiveMs: 60_000,
      segmentStartedAtUtc: 100_000,
    })
    expect(effectiveMs(s, 130_000)).toBe(90_000)
  })
})

describe('countdown remaining', () => {
  it('hits zero and reports finished', () => {
    const s = snap({
      plannedSeconds: 60,
      state: 'running',
      segmentStartedAtUtc: 0,
    })
    expect(remainingMs(s, 60_000)).toBe(0)
    expect(isFinished(s, 60_000)).toBe(true)
    expect(isFinished(s, 10_000)).toBe(false)
  })
})

describe('pausedMs', () => {
  it('accumulates only during pause', () => {
    const s = snap({
      state: 'paused',
      accumulatedPausedMs: 5_000,
      pauseStartedAtUtc: 20_000,
      segmentStartedAtUtc: null,
    })
    expect(pausedMs(s, 23_000)).toBe(8_000)
  })
})

import { describe, expect, it } from 'vitest'
import { poemForDay, POEMS } from './poems'

describe('poemForDay', () => {
  it('is stable within the same local day', () => {
    const morning = new Date(2026, 7, 13, 8, 0, 0).getTime()
    const night = new Date(2026, 7, 13, 22, 0, 0).getTime()
    expect(poemForDay(morning)).toEqual(poemForDay(night))
  })

  it('returns a catalogued verse', () => {
    const p = poemForDay(new Date(2026, 7, 13).getTime())
    expect(POEMS).toContainEqual(p)
    expect(p.text.length).toBeGreaterThan(4)
  })
})

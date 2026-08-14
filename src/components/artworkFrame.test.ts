import { describe, expect, it } from 'vitest'
import { computeFitTranslate, computeOverviewTranslate } from './artworkFrame'

describe('computeFitTranslate', () => {
  const stageW = 400
  const artW = 1000

  it('starts right-aligned so the line walks from the right edge', () => {
    expect(computeFitTranslate(0, artW, stageW)).toBe(stageW - artW)
  })

  it('holds the painting still until color fills the right half', () => {
    const pinStart = stageW / 2 / artW
    expect(computeFitTranslate(pinStart, artW, stageW)).toBe(stageW - artW)
    expect(computeFitTranslate(pinStart / 2, artW, stageW)).toBe(stageW - artW)
  })

  it('pins the line at screen center while there is room to pan', () => {
    const tx = computeFitTranslate(0.5, artW, stageW)
    const lineOnArt = (1 - 0.5) * artW
    expect(tx + lineOnArt).toBe(stageW / 2)
  })

  it('stops panning when gray can no longer fill the left half', () => {
    const pinEnd = 1 - stageW / 2 / artW
    expect(computeFitTranslate(pinEnd, artW, stageW)).toBe(0)
    expect(computeFitTranslate(1, artW, stageW)).toBe(0)
  })

  it('centers a painting that already fits', () => {
    expect(computeFitTranslate(0, 300, 400)).toBe(50)
    expect(computeFitTranslate(0.7, 300, 400)).toBe(50)
  })

  it('skips the right-edge mounting and starts the line at the screen’s right', () => {
    const inset = artW * 0.08
    const tx = computeFitTranslate(0, artW, stageW, inset)
    const lineOnArt = artW - inset
    expect(tx + lineOnArt).toBe(stageW)
    expect(tx).toBe(stageW - (artW - inset))
  })
})

describe('computeOverviewTranslate', () => {
  it('pans a wide handscroll from the right start to the left end', () => {
    expect(computeOverviewTranslate(0, 1000, 400, true)).toBe(-520)
    expect(computeOverviewTranslate(1, 1000, 400, true)).toBe(0)
    expect(computeOverviewTranslate(0.5, 1000, 400, true)).toBe(-260)
  })

  it('does not pan easel or fitting paintings', () => {
    expect(computeOverviewTranslate(0.4, 1000, 400, false)).toBe(0)
    expect(computeOverviewTranslate(0.4, 300, 400, true)).toBe(0)
  })
})

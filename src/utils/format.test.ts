import { describe, expect, it } from 'vitest'
import {
  coloringHoursToMinutes,
  formatColoringHours,
  minutesToColoringHours,
} from './format'

describe('coloring hours', () => {
  it('rounds minutes to one decimal hour', () => {
    expect(minutesToColoringHours(45)).toBe(0.8)
    expect(minutesToColoringHours(60)).toBe(1)
    expect(minutesToColoringHours(260)).toBe(4.3)
  })

  it('converts hours back to minutes at 0.1h steps', () => {
    expect(coloringHoursToMinutes(0.1)).toBe(6)
    expect(coloringHoursToMinutes(1.5)).toBe(90)
    expect(coloringHoursToMinutes(4.3)).toBe(258)
  })

  it('clamps out-of-range hours', () => {
    expect(coloringHoursToMinutes(0)).toBe(6)
    expect(coloringHoursToMinutes(100)).toBe(24 * 60)
  })

  it('formats with one decimal place', () => {
    expect(formatColoringHours(60)).toBe('1.0')
    expect(formatColoringHours(45)).toBe('0.8')
  })
})

import {describe, expect, it} from 'vitest'
import {addDays, daysBetween, eachDay, isIsoDate, toEpochDay} from '../dates'

describe('isIsoDate', () => {
  it('accepts real calendar dates', () => {
    expect(isIsoDate('2026-01-01')).toBe(true)
    expect(isIsoDate('2024-02-29')).toBe(true)
    expect(isIsoDate('2026-12-31')).toBe(true)
  })

  it('rejects impossible calendar dates', () => {
    expect(isIsoDate('2026-02-30')).toBe(false)
    expect(isIsoDate('2025-02-29')).toBe(false)
    expect(isIsoDate('2026-13-01')).toBe(false)
    expect(isIsoDate('2026-00-10')).toBe(false)
    expect(isIsoDate('2026-04-31')).toBe(false)
  })

  it('rejects malformed input', () => {
    expect(isIsoDate('2026-1-1')).toBe(false)
    expect(isIsoDate('26-01-01')).toBe(false)
    expect(isIsoDate('')).toBe(false)
    expect(isIsoDate(undefined)).toBe(false)
    expect(isIsoDate(20260101)).toBe(false)
  })
})

describe('epoch arithmetic', () => {
  it('round-trips across leap days', () => {
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29')
    expect(addDays('2024-02-29', 1)).toBe('2024-03-01')
  })

  it('handles year boundaries', () => {
    expect(addDays('2025-12-31', 1)).toBe('2026-01-01')
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31')
  })

  it('is timezone independent', () => {
    // Same instant regardless of the machine timezone.
    expect(toEpochDay('1970-01-01')).toBe(0)
    expect(toEpochDay('1970-01-02')).toBe(1)
  })

  it('measures whole-day differences', () => {
    expect(daysBetween('2026-01-01', '2026-01-01')).toBe(0)
    expect(daysBetween('2026-01-01', '2026-01-02')).toBe(1)
    expect(daysBetween('2026-01-01', '2026-01-05')).toBe(4)
    expect(daysBetween('2026-01-05', '2026-01-01')).toBe(-4)
  })
})

describe('eachDay', () => {
  it('yields a half-open range', () => {
    expect([...eachDay('2026-01-01', '2026-01-04')]).toEqual([
      '2026-01-01',
      '2026-01-02',
      '2026-01-03',
    ])
  })

  it('is empty when the range is inverted or zero-length', () => {
    expect([...eachDay('2026-01-04', '2026-01-01')]).toEqual([])
    expect([...eachDay('2026-01-01', '2026-01-01')]).toEqual([])
  })

  it('spans a leap February correctly', () => {
    const feb = [...eachDay('2024-02-27', '2024-03-02')]
    expect(feb).toEqual(['2024-02-27', '2024-02-28', '2024-02-29', '2024-03-01'])
    expect(feb).toHaveLength(4)
  })
})
import { describe, expect, it } from 'vitest'
import { at } from '../test/helpers.ts'
import { dayKey, dayStart, nextDayStart, previousDayKey } from './day.ts'

describe('gün sınırı 04:00', () => {
  it('04:00 sonrası aynı güne sayılır', () => {
    expect(dayStart(at(2026, 9, 28, 4, 0))).toEqual(at(2026, 9, 28, 4))
    expect(dayStart(at(2026, 9, 28, 23, 59))).toEqual(at(2026, 9, 28, 4))
  })

  it('gece yarısından sonra 04:00 öncesi önceki güne sayılır', () => {
    expect(dayStart(at(2026, 9, 29, 0, 30))).toEqual(at(2026, 9, 28, 4))
    expect(dayKey(at(2026, 9, 29, 3, 59))).toBe('2026-09-28')
    expect(dayKey(at(2026, 9, 29, 4, 0))).toBe('2026-09-29')
  })

  it('ay ve yıl geçişleri', () => {
    expect(dayKey(at(2026, 1, 1, 2))).toBe('2025-12-31')
    expect(nextDayStart(at(2026, 2, 28, 22))).toEqual(at(2026, 3, 1, 4))
    expect(previousDayKey('2026-03-01')).toBe('2026-02-28')
    expect(previousDayKey('2026-01-01')).toBe('2025-12-31')
  })
})

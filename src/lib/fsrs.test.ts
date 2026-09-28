import { createEmptyCard } from 'ts-fsrs'
import { describe, expect, it } from 'vitest'
import { formatInterval, intervalLabels, Rating, scheduler } from './fsrs.ts'

const MIN = 60_000
const DAY = 24 * 60 * MIN

describe('formatInterval', () => {
  it.each([
    [30_000, '1dk'],
    [10 * MIN, '10dk'],
    [3 * 60 * MIN, '3sa'],
    [DAY, '1g'],
    [4 * DAY, '4g'],
    [65 * DAY, '2ay'],
    [548 * DAY, '1,5y'],
    [59.8 * MIN, '1sa'],
    [DAY - 60_000, '1g'],
    [350 * DAY, '1y'],
  ])('%i ms → %s', (ms, label) => {
    expect(formatInterval(ms)).toBe(label)
  })
})

describe('intervalLabels', () => {
  it('yeni kartta Tekrar < Zor < İyi < Kolay', () => {
    const now = new Date(2026, 8, 28, 10)
    const labels = intervalLabels(scheduler.repeat(createEmptyCard(now), now), now)
    expect(labels[Rating.Again]).toBe('1dk')
    expect(labels[Rating.Good]).toBe('10dk')
    expect(labels[Rating.Easy]).toMatch(/g$/)
  })
})

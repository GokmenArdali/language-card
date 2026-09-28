import { State } from 'ts-fsrs'
import { describe, expect, it } from 'vitest'
import { buildCard } from '../db/repo.ts'
import type { CardRecord } from '../db/schema.ts'
import { at } from '../test/helpers.ts'
import { countQueue, isDueReview, newAllowance, pickNext } from './queue.ts'

const now = at(2026, 9, 28, 9)

function card(name: string, patch: Partial<CardRecord> = {}): CardRecord {
  return { ...buildCard({ front: name, back: name }, at(2026, 9, 1)), ...patch }
}
const review = (name: string, due: Date) => card(name, { state: State.Review, due })
const learning = (name: string, due: Date) => card(name, { state: State.Learning, due })

describe('isDueReview', () => {
  it('review kartı saatinden bağımsız olarak gün bitene (04:00) kadar hazır', () => {
    expect(isDueReview(review('a', at(2026, 9, 28, 20)), now)).toBe(true)
    expect(isDueReview(review('b', at(2026, 9, 29, 3, 59)), now)).toBe(true)
    expect(isDueReview(review('c', at(2026, 9, 29, 4)), now)).toBe(false)
  })

  it('öğrenme kartı en fazla 20 dk erken', () => {
    expect(isDueReview(learning('a', at(2026, 9, 28, 9, 20)), now)).toBe(true)
    expect(isDueReview(learning('b', at(2026, 9, 28, 9, 21)), now)).toBe(false)
  })

  it('yeni kart tekrar sayılmaz', () => {
    expect(isDueReview(card('n'), now)).toBe(false)
  })
})

describe('pickNext', () => {
  it('önce tekrarlar, sonra yeni kartlar', () => {
    const cards = [card('yeni'), review('tekrar', at(2026, 9, 27))]
    expect(pickNext(cards, now, 5)?.front).toBe('tekrar')
  })

  it('en eski vadeli tekrar önce gelir', () => {
    const cards = [review('b', at(2026, 9, 28, 8)), review('a', at(2026, 9, 20))]
    expect(pickNext(cards, now, 0)?.front).toBe('a')
  })

  it('vadesi gelmiş öğrenme kartı tekrarların önüne geçer', () => {
    const cards = [review('r', at(2026, 9, 20)), learning('l', at(2026, 9, 28, 8, 59))]
    expect(pickNext(cards, now, 0)?.front).toBe('l')
  })

  it('yeni kartlar eklenme sırasıyla gelir', () => {
    const cards = [card('ikinci', { createdAt: at(2026, 9, 2) }), card('birinci', { createdAt: at(2026, 9, 1) })]
    expect(pickNext(cards, now, 1)?.front).toBe('birinci')
  })

  it('limit dolunca yeni kart gösterilmez', () => {
    expect(pickNext([card('yeni')], now, 0)).toBeNull()
  })

  it('başka kart kalmayınca 20 dk içindeki öğrenme kartı öne alınır', () => {
    expect(pickNext([learning('l', at(2026, 9, 28, 9, 10))], now, 0)?.front).toBe('l')
    expect(pickNext([learning('l', at(2026, 9, 28, 10))], now, 0)).toBeNull()
  })

  it('yarının tekrarı bugün gösterilmez', () => {
    expect(pickNext([review('r', at(2026, 9, 29, 10))], now, 0)).toBeNull()
  })
})

describe('sayaçlar', () => {
  it('newAllowance negatife düşmez', () => {
    expect(newAllowance(7, 3)).toBe(4)
    expect(newAllowance(7, 9)).toBe(0)
  })

  it('countQueue', () => {
    const cards = [
      card('n1'),
      card('n2'),
      card('n3'),
      review('r1', at(2026, 9, 27)),
      review('r2', at(2026, 9, 30)),
      learning('l1', at(2026, 9, 28, 9)),
      learning('l2', at(2026, 9, 28, 15)),
    ]
    expect(countQueue(cards, now, 2)).toEqual({ due: 2, fresh: 2, totalNew: 3, learningLater: 1 })
  })
})

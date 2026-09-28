import { State } from 'ts-fsrs'
import type { CardRecord } from '../db/schema.ts'
import { nextDayStart } from './day.ts'

/** Öğrenme adımındaki kart, zamanı gelmeden en fazla bu kadar erken gösterilebilir (Anki'deki "learn ahead"). */
export const LEARN_AHEAD_MS = 20 * 60_000

const isLearning = (c: CardRecord) => c.state === State.Learning || c.state === State.Relearning

/**
 * Tekrar kartı bugün çalışılabilir mi?
 * - Review: bugün (bir sonraki 04:00'ten önce) vadesi gelenler — saati beklemeden sabah da çalışılabilir.
 * - Learning/Relearning: dakikalık adımlar; vadesi gelmiş ya da 20 dk içinde gelecek olanlar.
 */
export function isDueReview(card: CardRecord, now: Date): boolean {
  if (card.state === State.New) return false
  if (card.state === State.Review) return card.due < nextDayStart(now)
  return card.due.getTime() <= now.getTime() + LEARN_AHEAD_MS
}

/** Bugün hâlâ açılabilecek yeni kart sayısı. */
export function newAllowance(newCardsPerDay: number, newIntroducedToday: number): number {
  return Math.max(0, newCardsPerDay - newIntroducedToday)
}

const byDue = (a: CardRecord, b: CardRecord) => a.due.getTime() - b.due.getTime()
const byCreated = (a: CardRecord, b: CardRecord) => a.createdAt.getTime() - b.createdAt.getTime()

/**
 * Sıradaki kartı seçer. Öncelik:
 * 1. Vadesi gelmiş öğrenme kartları (dakikalık adımlar kaçmasın)
 * 2. Bugünkü tekrarlar (en eski vade önce)
 * 3. Yeni kartlar (limit dahilinde, en eski eklenen önce)
 * 4. 20 dk içinde vadesi gelecek öğrenme kartları (oturum beklemeden bitsin)
 */
export function pickNext(cards: readonly CardRecord[], now: Date, allowance: number): CardRecord | null {
  const t = now.getTime()
  const learningNow = cards.filter((c) => isLearning(c) && c.due.getTime() <= t).sort(byDue)
  if (learningNow.length) return learningNow[0]

  const tomorrow = nextDayStart(now)
  const reviews = cards.filter((c) => c.state === State.Review && c.due < tomorrow).sort(byDue)
  if (reviews.length) return reviews[0]

  if (allowance > 0) {
    const fresh = cards.filter((c) => c.state === State.New).sort(byCreated)
    if (fresh.length) return fresh[0]
  }

  const learningSoon = cards.filter((c) => isLearning(c) && c.due.getTime() <= t + LEARN_AHEAD_MS).sort(byDue)
  return learningSoon[0] ?? null
}

export interface QueueCounts {
  /** Bugün bekleyen tekrar (öğrenme + review) */
  due: number
  /** Bugün açılacak yeni kart */
  fresh: number
  /** Henüz hiç çalışılmamış toplam kart */
  totalNew: number
  /** 20 dk'dan sonra dönecek öğrenme kartları (oturum bitince bilgi için) */
  learningLater: number
}

export function countQueue(cards: readonly CardRecord[], now: Date, allowance: number): QueueCounts {
  let due = 0
  let totalNew = 0
  let learningLater = 0
  for (const c of cards) {
    if (c.state === State.New) totalNew++
    else if (isDueReview(c, now)) due++
    else if (isLearning(c) && c.due < nextDayStart(now)) learningLater++
  }
  return { due, fresh: Math.min(allowance, totalNew), totalNew, learningLater }
}

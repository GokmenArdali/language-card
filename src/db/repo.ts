import { createEmptyCard, State, type Grade } from 'ts-fsrs'
import { dayKey, dayStart, previousDayKey } from '../lib/day.ts'
import { Rating, scheduler } from '../lib/fsrs.ts'
import {
  db,
  DEFAULT_SETTINGS,
  LEECH_THRESHOLD,
  type CardRecord,
  type ReviewLogRecord,
  type Settings,
} from './schema.ts'

export interface CardContent {
  front: string
  back: string
  hint?: string
  source?: string
  tags?: string[]
}

const clean = (s: string | undefined) => {
  const t = s?.trim()
  return t ? t : undefined
}

function cleanContent(input: CardContent): CardContent {
  const tags = input.tags?.map((t) => t.trim()).filter(Boolean)
  return {
    front: input.front.trim(),
    back: input.back.trim(),
    hint: clean(input.hint),
    source: clean(input.source),
    tags: tags?.length ? tags : undefined,
  }
}

/** Yeni (hiç çalışılmamış) kart kaydı oluşturur; veritabanına yazmaz. */
export function buildCard(input: CardContent, now = new Date()): CardRecord {
  const content = cleanContent(input)
  if (!content.front || !content.back) throw new Error('Türkçe ve İngilizce alanları zorunlu')
  return {
    ...createEmptyCard(now),
    ...content,
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
    againCount: 0,
    isLeech: false,
  }
}

export async function addCard(input: CardContent, now = new Date()): Promise<CardRecord> {
  const card = buildCard(input, now)
  await db.cards.add(card)
  return card
}

/**
 * Kart içeriğini günceller. `clearLeech` verilirse sorunlu işareti kalkar ve
 * "Tekrar" sayacı sıfırlanır (kart düzeltildi, yeniden şans tanınıyor).
 */
export async function updateCard(
  id: string,
  input: CardContent,
  { clearLeech = false }: { clearLeech?: boolean } = {},
  now = new Date(),
): Promise<void> {
  const content = cleanContent(input)
  if (!content.front || !content.back) throw new Error('Türkçe ve İngilizce alanları zorunlu')
  await db.transaction('rw', db.cards, async () => {
    const card = await db.cards.get(id)
    if (!card) throw new Error('Kart bulunamadı')
    const next: CardRecord = { ...card, ...content, updatedAt: now }
    if (clearLeech) {
      next.isLeech = false
      next.againCount = 0
    }
    await db.cards.put(next)
  })
}

/** Kartı ve ona ait tekrar geçmişini siler. */
export async function deleteCard(id: string): Promise<void> {
  await db.transaction('rw', db.cards, db.logs, async () => {
    await db.logs.where('cardId').equals(id).delete()
    await db.cards.delete(id)
  })
}

export interface ReviewResult {
  card: CardRecord
  log: ReviewLogRecord
  /** Geri alma için kartın tekrar öncesi hâli */
  previous: CardRecord
  /** Bu tekrarla kart sorunlu hâle geldiyse true */
  becameLeech: boolean
}

/**
 * Kartı notlandırır. `now` zamanlama için kullanılan an: aralık önizlemesi ile aynı
 * `now` verilirse ekranda gösterilen aralık ile uygulanan aralık birebir aynı olur.
 */
export async function reviewCard(
  id: string,
  grade: Grade,
  now = new Date(),
  reviewedAt = new Date(),
): Promise<ReviewResult> {
  return db.transaction('rw', db.cards, db.logs, async () => {
    const previous = await db.cards.get(id)
    if (!previous) throw new Error('Kart bulunamadı')
    const { card: scheduled, log: fsrsLog } = scheduler.next(previous, now, grade)
    const againCount = previous.againCount + (grade === Rating.Again ? 1 : 0)
    const isLeech = previous.isLeech || againCount >= LEECH_THRESHOLD
    const card: CardRecord = { ...previous, ...scheduled, againCount, isLeech }
    const log: ReviewLogRecord = { ...fsrsLog, id: crypto.randomUUID(), cardId: id, reviewedAt }
    await db.cards.put(card)
    await db.logs.add(log)
    return { card, log, previous, becameLeech: isLeech && !previous.isLeech }
  })
}

/** Son notlandırmayı geri alır: kartı eski hâline döndürür ve kaydı siler. */
export async function undoReview(result: Pick<ReviewResult, 'previous' | 'log'>): Promise<void> {
  await db.transaction('rw', db.cards, db.logs, async () => {
    await db.logs.delete(result.log.id)
    await db.cards.put(result.previous)
  })
}

/** Bugün (04:00'ten beri) ilk kez çalışılan yeni kart sayısı. */
export async function countNewIntroducedToday(now = new Date()): Promise<number> {
  return db.logs
    .where('reviewedAt')
    .aboveOrEqual(dayStart(now))
    .filter((l) => l.state === State.New)
    .count()
}

/** Bugün yapılan tekrar sayısı. */
export async function countReviewsToday(now = new Date()): Promise<number> {
  return db.logs.where('reviewedAt').aboveOrEqual(dayStart(now)).count()
}

/**
 * Art arda çalışılan gün sayısı. Bugün henüz çalışılmadıysa dünden geriye sayılır
 * (seri gün bitene kadar bozulmaz).
 */
export async function getStreak(now = new Date()): Promise<{ days: number; studiedToday: boolean }> {
  const days = new Set<string>()
  const keys = (await db.logs.orderBy('reviewedAt').keys()) as Date[]
  for (const k of keys) days.add(dayKey(k))

  const today = dayKey(now)
  const studiedToday = days.has(today)
  let cursor = studiedToday ? today : previousDayKey(today)
  let count = 0
  while (days.has(cursor)) {
    count++
    cursor = previousDayKey(cursor)
  }
  return { days: count, studiedToday }
}

export async function getSettings(): Promise<Settings> {
  const row = await db.settings.get('app')
  if (!row) return { ...DEFAULT_SETTINGS }
  const { key: _key, ...rest } = row
  return { ...DEFAULT_SETTINGS, ...rest }
}

export async function updateSettings(patch: Partial<Settings>): Promise<Settings> {
  return db.transaction('rw', db.settings, async () => {
    const next = { ...(await getSettings()), ...patch }
    await db.settings.put({ ...next, key: 'app' })
    return next
  })
}

import { State } from 'ts-fsrs'
import { describe, expect, it } from 'vitest'
import { Rating } from '../lib/fsrs.ts'
import { at, useFreshDb } from '../test/helpers.ts'
import {
  addCard,
  countNewIntroducedToday,
  countReviewsToday,
  deleteCard,
  getSettings,
  getStreak,
  reviewCard,
  undoReview,
  updateCard,
  updateSettings,
} from './repo.ts'
import { db } from './schema.ts'

useFreshDb()

const sample = { front: '  Koşmak zorundayım ', back: 'I have to run', hint: 'run…', source: 'Friends S1E3' }

describe('kart ekleme / düzenleme / silme', () => {
  it('yeni kart FSRS durumuyla kaydedilir, boş alanlar temizlenir', async () => {
    const now = at(2026, 9, 28, 10)
    const card = await addCard({ ...sample, hint: '  ', tags: ['fiil', ' '] }, now)
    const saved = await db.cards.get(card.id)
    expect(saved).toMatchObject({
      front: 'Koşmak zorundayım',
      back: 'I have to run',
      source: 'Friends S1E3',
      tags: ['fiil'],
      state: State.New,
      reps: 0,
      lapses: 0,
      againCount: 0,
      isLeech: false,
    })
    expect(saved?.hint).toBeUndefined()
    expect(saved?.due).toEqual(now)
    expect(saved?.createdAt).toEqual(now)
  })

  it('Türkçe veya İngilizce boşsa hata verir', async () => {
    await expect(addCard({ front: ' ', back: 'x' })).rejects.toThrow()
  })

  it('düzenleme updatedAt değiştirir, zamanlamayı korur', async () => {
    const card = await addCard(sample, at(2026, 9, 1))
    await reviewCard(card.id, Rating.Good, at(2026, 9, 2))
    const before = (await db.cards.get(card.id))!
    await updateCard(card.id, { front: 'Yeni', back: 'New' }, {}, at(2026, 9, 3))
    const after = (await db.cards.get(card.id))!
    expect(after.front).toBe('Yeni')
    expect(after.hint).toBeUndefined()
    expect(after.updatedAt).toEqual(at(2026, 9, 3))
    expect(after.due).toEqual(before.due)
    expect(after.reps).toBe(1)
  })

  it('silme, kartın tekrar geçmişini de siler', async () => {
    const a = await addCard(sample)
    const b = await addCard({ front: 'b', back: 'b' })
    await reviewCard(a.id, Rating.Good)
    await reviewCard(b.id, Rating.Good)
    await deleteCard(a.id)
    expect(await db.cards.count()).toBe(1)
    const logs = await db.logs.toArray()
    expect(logs).toHaveLength(1)
    expect(logs[0].cardId).toBe(b.id)
  })
})

describe('tekrar', () => {
  it('kartı günceller ve log yazar', async () => {
    const card = await addCard(sample, at(2026, 9, 28, 9))
    const now = at(2026, 9, 28, 10)
    const { card: updated, log } = await reviewCard(card.id, Rating.Good, now, now)
    expect(updated.state).toBe(State.Learning)
    expect(updated.due).toEqual(new Date(now.getTime() + 10 * 60_000))
    expect(log).toMatchObject({ cardId: card.id, rating: Rating.Good, state: State.New, reviewedAt: now })
    expect(await db.logs.count()).toBe(1)
  })

  it('toplam 4 "Tekrar" sonrası kart sorunlu olur', async () => {
    const card = await addCard(sample)
    const t = at(2026, 9, 28, 10).getTime()
    const results = []
    for (let i = 0; i < 4; i++) results.push(await reviewCard(card.id, Rating.Again, new Date(t + i * 120_000)))
    expect(results.map((r) => r.becameLeech)).toEqual([false, false, false, true])
    const saved = (await db.cards.get(card.id))!
    expect(saved.againCount).toBe(4)
    expect(saved.isLeech).toBe(true)

    // Arada İyi verilse de işaret kalır
    await reviewCard(card.id, Rating.Good, new Date(t + 10 * 120_000))
    expect((await db.cards.get(card.id))!.isLeech).toBe(true)
  })

  it('düzenlerken sorunlu işareti kaldırılabilir', async () => {
    const card = await addCard(sample)
    for (let i = 0; i < 4; i++) await reviewCard(card.id, Rating.Again, new Date(Date.now() + i * 120_000))
    await updateCard(card.id, sample, { clearLeech: true })
    expect(await db.cards.get(card.id)).toMatchObject({ isLeech: false, againCount: 0 })
  })

  it('geri alma kartı eski hâline döndürür ve logu siler', async () => {
    const card = await addCard(sample)
    const result = await reviewCard(card.id, Rating.Easy)
    await undoReview(result)
    expect(await db.cards.get(card.id)).toEqual(card)
    expect(await db.logs.count()).toBe(0)
  })
})

describe('günlük sayaçlar ve seri', () => {
  it('bugün açılan yeni kartlar 04:00 sınırıyla sayılır', async () => {
    const a = await addCard({ front: 'a', back: 'a' })
    const b = await addCard({ front: 'b', back: 'b' })
    const c = await addCard({ front: 'c', back: 'c' })
    await reviewCard(a.id, Rating.Good, at(2026, 9, 28, 3), at(2026, 9, 28, 3)) // önceki güne sayılır
    await reviewCard(b.id, Rating.Good, at(2026, 9, 28, 10), at(2026, 9, 28, 10))
    await reviewCard(b.id, Rating.Good, at(2026, 9, 28, 10, 15), at(2026, 9, 28, 10, 15)) // artık yeni değil
    await reviewCard(c.id, Rating.Again, at(2026, 9, 29, 1), at(2026, 9, 29, 1)) // hâlâ 28'i
    const now = at(2026, 9, 29, 2)
    expect(await countNewIntroducedToday(now)).toBe(2)
    expect(await countReviewsToday(now)).toBe(3)
  })

  it('seri: art arda günler, bugün çalışılmadıysa dünden sayar', async () => {
    const card = await addCard(sample)
    for (const d of [20, 25, 26, 27]) {
      const t = at(2026, 9, d, 21)
      await reviewCard(card.id, Rating.Good, t, t)
    }
    expect(await getStreak(at(2026, 9, 28, 10))).toEqual({ days: 3, studiedToday: false })
    // 29'u gece 02:00 → 28'ine sayılır
    await reviewCard(card.id, Rating.Good, at(2026, 9, 29, 2), at(2026, 9, 29, 2))
    expect(await getStreak(at(2026, 9, 29, 3))).toEqual({ days: 4, studiedToday: true })
    expect(await getStreak(at(2026, 9, 30, 10))).toEqual({ days: 0, studiedToday: false })
  })
})

describe('ayarlar', () => {
  it('varsayılanlar ve güncelleme', async () => {
    expect(await getSettings()).toEqual({ newCardsPerDay: 7, ttsRate: 0.9, autoSpeak: true, lastBackupAt: null })
    await updateSettings({ newCardsPerDay: 10 })
    expect(await getSettings()).toMatchObject({ newCardsPerDay: 10, ttsRate: 0.9 })
  })
})

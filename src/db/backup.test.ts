import { describe, expect, it } from 'vitest'
import { Rating } from '../lib/fsrs.ts'
import { at, useFreshDb } from '../test/helpers.ts'
import {
  createBackup,
  csvRowsToCards,
  importBackup,
  importCsv,
  parseBackup,
  parseCsv,
  serializeBackup,
} from './backup.ts'
import { addCard, reviewCard, updateCard, updateSettings } from './repo.ts'
import { db } from './schema.ts'

useFreshDb()

async function roundTrip() {
  return parseBackup(serializeBackup(await createBackup()))
}

describe('JSON yedek', () => {
  it('dışa aktar → üzerine yaz: veriler ve tarihler birebir geri gelir', async () => {
    const card = await addCard({ front: 'a', back: 'a', source: 'S1' }, at(2026, 9, 1))
    await reviewCard(card.id, Rating.Good, at(2026, 9, 2), at(2026, 9, 2))
    await updateSettings({ newCardsPerDay: 12, lastBackupAt: at(2026, 9, 1) })
    const before = { cards: await db.cards.toArray(), logs: await db.logs.toArray() }

    const backup = await roundTrip()
    await addCard({ front: 'silinecek', back: 'x' })
    await updateSettings({ newCardsPerDay: 3 })

    const summary = await importBackup(backup, 'replace')
    expect(summary).toEqual({ cardsAdded: 1, cardsUpdated: 0, logsAdded: 1 })
    expect(await db.cards.toArray()).toEqual(before.cards)
    expect(await db.logs.toArray()).toEqual(before.logs)
    expect((await db.cards.toArray())[0].due).toBeInstanceOf(Date)
    expect(await db.settings.get('app')).toMatchObject({ newCardsPerDay: 12, lastBackupAt: at(2026, 9, 1) })
  })

  it('birleştir: yeniler eklenir, daha güncel sürüm kalır, ayarlar korunur', async () => {
    const shared = await addCard({ front: 'ortak', back: 'shared' }, at(2026, 9, 1))
    const other = await addCard({ front: 'diğer', back: 'other' }, at(2026, 9, 1))
    const backup = await roundTrip()

    // Yerelde ortak kart yedekten sonra çalışıldı
    await reviewCard(shared.id, Rating.Good, at(2026, 9, 5), at(2026, 9, 5))
    // Yedekte diğer kart daha sonra düzenlenmiş, bir de yeni kart var
    const otherInBackup = backup.cards.find((c) => c.id === other.id)!
    otherInBackup.back = 'other (düzeltildi)'
    otherInBackup.updatedAt = at(2026, 9, 6)
    const extra = await addCard({ front: 'yeni', back: 'new' })
    backup.cards.push((await db.cards.get(extra.id))!)
    await db.cards.delete(extra.id)
    await updateSettings({ newCardsPerDay: 20 })

    const summary = await importBackup(backup, 'merge')
    expect(summary).toEqual({ cardsAdded: 1, cardsUpdated: 1, logsAdded: 0 })
    expect((await db.cards.get(shared.id))!.reps).toBe(1) // yerel (daha yeni) korundu
    expect((await db.cards.get(other.id))!.back).toBe('other (düzeltildi)')
    expect(await db.cards.count()).toBe(3)
    expect(await db.logs.count()).toBe(1)
    expect((await db.settings.get('app'))!.newCardsPerDay).toBe(20)
  })

  it('birleştir iki kez çalıştırılınca kopya oluşturmaz', async () => {
    const card = await addCard({ front: 'a', back: 'a' })
    await reviewCard(card.id, Rating.Good)
    const backup = await roundTrip()
    await importBackup(backup, 'merge')
    await importBackup(backup, 'merge')
    expect(await db.cards.count()).toBe(1)
    expect(await db.logs.count()).toBe(1)
  })

  it('içerik düzenlemesi de "daha yeni" sayılır', async () => {
    const card = await addCard({ front: 'a', back: 'a' }, at(2026, 9, 1))
    const backup = await roundTrip()
    await updateCard(card.id, { front: 'a', back: 'A!' }, {}, at(2026, 9, 3))
    await importBackup(backup, 'merge')
    expect((await db.cards.get(card.id))!.back).toBe('A!')
  })

  it('geçersiz dosyaları reddeder', () => {
    expect(() => parseBackup('not json')).toThrow('JSON')
    expect(() => parseBackup('{"format":"baska"}')).toThrow('yedeği değil')
    expect(() =>
      parseBackup(JSON.stringify({ format: 'language-card-backup', version: 1, cards: [{ id: 1 }], logs: [] })),
    ).toThrow('Kart #1')
  })
})

describe('CSV', () => {
  it('tırnak, virgül, satır sonu ve BOM', () => {
    const text =
      '﻿front,back,hint,source\r\n"Merhaba, dünya","Hello, world",,S1\n"O ""evet"" dedi","He said ""yes""\nloudly",say…,\n\n'
    expect(parseCsv(text)).toEqual([
      ['front', 'back', 'hint', 'source'],
      ['Merhaba, dünya', 'Hello, world', '', 'S1'],
      ['O "evet" dedi', 'He said "yes"\nloudly', 'say…', ''],
    ])
  })

  it('noktalı virgül ayırıcısını algılar (Türkçe Excel)', () => {
    expect(parseCsv('Türkçe;İngilizce\nKoş;Run')).toEqual([
      ['Türkçe', 'İngilizce'],
      ['Koş', 'Run'],
    ])
  })

  it('başlıksız dosyada sıra front,back,hint,source; eksik satırlar geçersiz sayılır', () => {
    expect(csvRowsToCards([['a', 'b', 'c', 'd'], ['sadece'], ['x', 'y']])).toEqual({
      cards: [
        { front: 'a', back: 'b', hint: 'c', source: 'd' },
        { front: 'x', back: 'y' },
      ],
      invalid: 1,
    })
  })

  it('Türkçe başlıklar ve farklı sütun sırası', () => {
    expect(csvRowsToCards(parseCsv('Kaynak;İngilizce;Türkçe\nS2;Run;Koş'))).toEqual({
      cards: [{ front: 'Koş', back: 'Run', source: 'S2' }],
      invalid: 0,
    })
  })

  it('içe aktarma: kopyaları atlar, dosyadaki sırayı korur', async () => {
    await addCard({ front: 'Koş', back: 'Run' }, at(2026, 9, 1))
    const text = 'front,back,hint,source\nkoş,run,,\nBir,One,,S1\nİki,Two,,S1\nBir,One,,\n,eksik,,'
    const summary = await importCsv(text, at(2026, 9, 28))
    expect(summary).toEqual({ added: 2, duplicates: 2, invalid: 1 })
    const all = await db.cards.orderBy('createdAt').toArray()
    expect(all.map((c) => c.front)).toEqual(['Koş', 'Bir', 'İki'])
    expect(all[1].source).toBe('S1')
  })
})

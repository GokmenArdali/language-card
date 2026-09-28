import { buildCard } from './repo.ts'
import { db, DEFAULT_SETTINGS, type CardRecord, type ReviewLogRecord, type Settings } from './schema.ts'

export const BACKUP_FORMAT = 'language-card-backup'
export const BACKUP_VERSION = 1

export interface BackupFile {
  format: typeof BACKUP_FORMAT
  version: number
  exportedAt: Date
  cards: CardRecord[]
  logs: ReviewLogRecord[]
  settings: Settings
}

export async function createBackup(now = new Date()): Promise<BackupFile> {
  return db.transaction('r', db.cards, db.logs, db.settings, async () => {
    const row = await db.settings.get('app')
    const { key: _key, ...settings } = row ?? { key: 'app', ...DEFAULT_SETTINGS }
    return {
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      exportedAt: now,
      cards: await db.cards.toArray(),
      logs: await db.logs.toArray(),
      settings: { ...DEFAULT_SETTINGS, ...settings },
    }
  })
}

export function backupFileName(now = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0')
  const date = `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`
  return `kartlar-yedek-${date}-${p(now.getHours())}${p(now.getMinutes())}.json`
}

/** Tarihler ISO metne dönüşür; `parseBackup` geri çevirir. */
export function serializeBackup(backup: BackupFile): string {
  return JSON.stringify(backup)
}

export class BackupError extends Error {}

function toDate(value: unknown, field: string): Date {
  const d = new Date(value as string)
  if (value == null || Number.isNaN(d.getTime())) throw new BackupError(`Geçersiz tarih: ${field}`)
  return d
}
const toOptionalDate = (value: unknown, field: string) => (value == null ? undefined : toDate(value, field))

type Raw = Record<string, unknown>

/** JSON metnini doğrular ve tarih alanlarını Date nesnesine çevirir. */
export function parseBackup(text: string): BackupFile {
  let raw: Raw
  try {
    raw = JSON.parse(text)
  } catch {
    throw new BackupError('Dosya geçerli bir JSON değil')
  }
  if (raw?.format !== BACKUP_FORMAT) throw new BackupError('Bu dosya bu uygulamanın yedeği değil')
  if (typeof raw.version !== 'number' || raw.version > BACKUP_VERSION)
    throw new BackupError('Yedek, uygulamanın daha yeni bir sürümüyle alınmış')
  if (!Array.isArray(raw.cards) || !Array.isArray(raw.logs)) throw new BackupError('Yedekte kart listesi yok')

  const cards = (raw.cards as Raw[]).map((c, i): CardRecord => {
    if (
      typeof c?.id !== 'string' ||
      typeof c.front !== 'string' ||
      typeof c.back !== 'string' ||
      typeof c.state !== 'number'
    )
      throw new BackupError(`Kart #${i + 1} bozuk`)
    const card = {
      ...c,
      due: toDate(c.due, 'due'),
      createdAt: toDate(c.createdAt, 'createdAt'),
      updatedAt: toDate(c.updatedAt ?? c.createdAt, 'updatedAt'),
      againCount: typeof c.againCount === 'number' ? c.againCount : 0,
      isLeech: c.isLeech === true,
    } as CardRecord
    const lastReview = toOptionalDate(c.last_review, 'last_review')
    if (lastReview) card.last_review = lastReview
    else delete card.last_review
    return card
  })

  const logs = (raw.logs as Raw[]).map((l, i): ReviewLogRecord => {
    if (typeof l?.id !== 'string' || typeof l.cardId !== 'string' || typeof l.rating !== 'number')
      throw new BackupError(`Tekrar kaydı #${i + 1} bozuk`)
    return {
      ...l,
      due: toDate(l.due, 'due'),
      review: toDate(l.review, 'review'),
      reviewedAt: toDate(l.reviewedAt, 'reviewedAt'),
    } as ReviewLogRecord
  })

  const s = (raw.settings ?? {}) as Raw
  const settings: Settings = {
    ...DEFAULT_SETTINGS,
    ...s,
    lastBackupAt: toOptionalDate(s.lastBackupAt, 'lastBackupAt') ?? null,
  }

  return {
    format: BACKUP_FORMAT,
    version: raw.version,
    exportedAt: toOptionalDate(raw.exportedAt, 'exportedAt') ?? new Date(0),
    cards,
    logs,
    settings,
  }
}

export type ImportMode = 'merge' | 'replace'

export interface ImportSummary {
  cardsAdded: number
  cardsUpdated: number
  logsAdded: number
}

/** Kartın en son değiştiği an (içerik düzenlemesi ya da tekrar). */
const lastActivity = (c: CardRecord) => Math.max(c.updatedAt.getTime(), c.last_review?.getTime() ?? 0)

/**
 * - replace: mevcut tüm veriler silinir, yedek aynen yüklenir (ayarlar dahil).
 * - merge: yeni kartlar eklenir; iki tarafta da olan kartta daha yakın zamanda
 *   değişen/çalışılan sürüm kalır; eksik tekrar kayıtları eklenir; ayarlar korunur.
 */
export async function importBackup(backup: BackupFile, mode: ImportMode): Promise<ImportSummary> {
  return db.transaction('rw', db.cards, db.logs, db.settings, async () => {
    if (mode === 'replace') {
      await Promise.all([db.cards.clear(), db.logs.clear(), db.settings.clear()])
      await db.cards.bulkAdd(backup.cards)
      await db.logs.bulkAdd(backup.logs)
      await db.settings.put({ ...backup.settings, key: 'app' })
      return { cardsAdded: backup.cards.length, cardsUpdated: 0, logsAdded: backup.logs.length }
    }

    const existing = await db.cards.bulkGet(backup.cards.map((c) => c.id))
    const toPut: CardRecord[] = []
    let cardsAdded = 0
    let cardsUpdated = 0
    backup.cards.forEach((incoming, i) => {
      const current = existing[i]
      if (!current) {
        toPut.push(incoming)
        cardsAdded++
      } else if (lastActivity(incoming) > lastActivity(current)) {
        toPut.push(incoming)
        cardsUpdated++
      }
    })
    await db.cards.bulkPut(toPut)

    const existingLogs = await db.logs.bulkGet(backup.logs.map((l) => l.id))
    const newLogs = backup.logs.filter((_, i) => !existingLogs[i])
    await db.logs.bulkAdd(newLogs)
    return { cardsAdded, cardsUpdated, logsAdded: newLogs.length }
  })
}

/* ------------------------------------------------------------------ CSV */

/** RFC 4180 CSV ayrıştırıcı. Ayırıcı (virgül / noktalı virgül / sekme) ilk satırdan tahmin edilir. */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, '')
  const delimiter = detectDelimiter(src)
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false

  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"'
          i++
        } else quoted = false
      } else field += ch
    } else if (ch === '"' && field === '') {
      quoted = true
    } else if (ch === delimiter) {
      row.push(field)
      field = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else field += ch
  }
  if (field !== '' || row.length) {
    row.push(field)
    rows.push(row)
  }
  return rows.filter((r) => r.some((f) => f.trim() !== ''))
}

function detectDelimiter(text: string): string {
  let firstLine = ''
  let quoted = false
  for (const ch of text) {
    if (ch === '"') quoted = !quoted
    if (!quoted && (ch === '\n' || ch === '\r')) break
    if (!quoted) firstLine += ch
  }
  let best = ','
  let bestCount = 0
  for (const d of [',', ';', '\t']) {
    const n = firstLine.split(d).length - 1
    if (n > bestCount) {
      best = d
      bestCount = n
    }
  }
  return best
}

type CsvColumn = 'front' | 'back' | 'hint' | 'source'

const HEADER_ALIASES: Record<string, CsvColumn> = {
  front: 'front',
  'türkçe': 'front',
  turkce: 'front',
  back: 'back',
  ingilizce: 'back',
  english: 'back',
  hint: 'hint',
  ipucu: 'hint',
  source: 'source',
  kaynak: 'source',
}

function headerColumn(title: string): CsvColumn | undefined {
  // "İngilizce" tr küçük harfe "ingilizce" olur; Türkçe dışı yazımlar için de normalleştir.
  const key = title.trim().toLocaleLowerCase('tr').normalize('NFC')
  return HEADER_ALIASES[key]
}

export interface CsvRow {
  front: string
  back: string
  hint?: string
  source?: string
}

/** Satırları kart alanlarına eşler. Başlık satırı varsa sütun sırası başlıktan okunur, yoksa front,back,hint,source. */
export function csvRowsToCards(rows: string[][]): { cards: CsvRow[]; invalid: number } {
  if (!rows.length) return { cards: [], invalid: 0 }
  let columns: (CsvColumn | undefined)[] = ['front', 'back', 'hint', 'source']
  let body = rows
  const header = rows[0].map(headerColumn)
  if (header.includes('front') && header.includes('back')) {
    columns = header
    body = rows.slice(1)
  }

  const cards: CsvRow[] = []
  let invalid = 0
  for (const r of body) {
    const card: Partial<CsvRow> = {}
    columns.forEach((col, i) => {
      if (col && r[i] !== undefined) card[col] = r[i].trim()
    })
    if (card.front && card.back) cards.push(card as CsvRow)
    else invalid++
  }
  return { cards, invalid }
}

export interface CsvImportSummary {
  added: number
  duplicates: number
  invalid: number
}

const dedupeKey = (front: string, back: string) =>
  `${front.trim().toLocaleLowerCase('tr')}\u0000${back.trim().toLocaleLowerCase('tr')}`

/** CSV'deki kartları yeni kart olarak ekler; Türkçe+İngilizce'si aynı olan kartları atlar. */
export async function importCsv(text: string, now = new Date()): Promise<CsvImportSummary> {
  const { cards, invalid } = csvRowsToCards(parseCsv(text))
  return db.transaction('rw', db.cards, async () => {
    const seen = new Set<string>()
    await db.cards.each((c) => {
      seen.add(dedupeKey(c.front, c.back))
    })
    const records: CardRecord[] = []
    let duplicates = 0
    for (const row of cards) {
      const key = dedupeKey(row.front, row.back)
      if (seen.has(key)) {
        duplicates++
        continue
      }
      seen.add(key)
      // Dosyadaki sıra korunsun diye her karta 1 ms sonraki oluşturma zamanı verilir.
      records.push(buildCard(row, new Date(now.getTime() + records.length)))
    }
    await db.cards.bulkAdd(records)
    return { added: records.length, duplicates, invalid }
  })
}

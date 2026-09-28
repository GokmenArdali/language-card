import { State } from 'ts-fsrs'
import type { CardRecord } from '../db/schema.ts'
import { nextDayStart } from './day.ts'
import { formatInterval } from './fsrs.ts'

export const stateLabels: Record<State, string> = {
  [State.New]: 'Yeni',
  [State.Learning]: 'Öğreniliyor',
  [State.Review]: 'Tekrarda',
  [State.Relearning]: 'Yeniden öğreniliyor',
}

/** Listede gösterilecek kısa vade metni: "Yeni", "Bugün", "3g sonra". */
export function dueLabel(card: CardRecord, now: Date): string {
  if (card.state === State.New) return 'Yeni'
  if (card.due <= now) return 'Bugün'
  if (card.state === State.Review && card.due < nextDayStart(now)) return 'Bugün'
  return `${formatInterval(card.due.getTime() - now.getTime())} sonra`
}

/** Aksan ve büyük/küçük harf duyarsız arama anahtarı ("Koş" ~ "kos", "İ" ~ "i", "ı" ~ "i"). */
export function searchKey(s: string): string {
  return s
    .toLocaleLowerCase('tr')
    .replace(/ı/g, 'i')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

export function matchesSearch(card: CardRecord, query: string): boolean {
  const q = searchKey(query.trim())
  if (!q) return true
  const hay = searchKey([card.front, card.back, card.hint, card.source, ...(card.tags ?? [])].filter(Boolean).join('\n'))
  return q.split(/\s+/).every((word) => hay.includes(word))
}

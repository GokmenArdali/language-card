import Dexie, { type EntityTable } from 'dexie'
import type { Card as FsrsCard, ReviewLog as FsrsReviewLog } from 'ts-fsrs'

/** Kart: içerik + ts-fsrs'in Card tipindeki tüm zamanlama alanları (due, stability, lapses, state…). */
export interface CardRecord extends FsrsCard {
  id: string
  /** Türkçe (ön yüz) */
  front: string
  /** İngilizce (arka yüz) */
  back: string
  hint?: string
  source?: string
  tags?: string[]
  createdAt: Date
  /** Yalnızca içerik düzenlenince değişir; tekrar yapmak değiştirmez. */
  updatedAt: Date
  /** Toplam "Tekrar" (Again) sayısı; FSRS'in `lapses` alanından farklı olarak öğrenme aşamasını da sayar. */
  againCount: number
  isLeech: boolean
}

/** Tekrar geçmişi: ts-fsrs ReviewLog alanları (state = tekrar öncesi durum) + kimlik bilgileri. */
export interface ReviewLogRecord extends FsrsReviewLog {
  id: string
  cardId: string
  reviewedAt: Date
}

export interface Settings {
  newCardsPerDay: number
  ttsRate: number
  autoSpeak: boolean
  /** Seçilen İngilizce sesin voiceURI'si; boşsa ilk en-US ses kullanılır. */
  ttsVoiceURI?: string
  lastBackupAt: Date | null
}

export interface SettingsRecord extends Settings {
  key: 'app'
}

export const DEFAULT_SETTINGS: Settings = {
  newCardsPerDay: 7,
  ttsRate: 0.9,
  autoSpeak: true,
  lastBackupAt: null,
}

/** Kart başına bu kadar "Tekrar" alınca sorunlu (leech) sayılır. */
export const LEECH_THRESHOLD = 4

export class AppDB extends Dexie {
  cards!: EntityTable<CardRecord, 'id'>
  logs!: EntityTable<ReviewLogRecord, 'id'>
  settings!: EntityTable<SettingsRecord, 'key'>

  constructor(name = 'language-card') {
    super(name)
    this.version(1).stores({
      cards: 'id, due, state, createdAt',
      logs: 'id, cardId, reviewedAt',
      settings: 'key',
    })
  }
}

export const db = new AppDB()

import { beforeEach } from 'vitest'
import { db } from '../db/schema.ts'

/** Her testten önce veritabanını boşaltır. */
export function useFreshDb() {
  beforeEach(async () => {
    await Promise.all([db.cards.clear(), db.logs.clear(), db.settings.clear()])
  })
}

/** Yerel saatle tarih: at(2026, 9, 28, 10, 30) → 28 Eylül 2026 10:30 */
export const at = (y: number, m: number, d: number, h = 12, min = 0) => new Date(y, m - 1, d, h, min)

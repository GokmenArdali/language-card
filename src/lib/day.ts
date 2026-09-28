/** Gün 04:00'te başlar: gece yarısından sonra çalışmak önceki güne sayılır. */
export const DAY_START_HOUR = 4

/** `now` anının ait olduğu günün başlangıcı (yerel saatle 04:00). */
export function dayStart(now: Date): Date {
  const d = new Date(now)
  if (d.getHours() < DAY_START_HOUR) d.setDate(d.getDate() - 1)
  d.setHours(DAY_START_HOUR, 0, 0, 0)
  return d
}

/** Bir sonraki günün başlangıcı. */
export function nextDayStart(now: Date): Date {
  const d = dayStart(now)
  d.setDate(d.getDate() + 1)
  return d
}

/** "2026-09-28" biçiminde gün anahtarı (04:00 kaydırmalı). */
export function dayKey(date: Date): string {
  const d = dayStart(date)
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

/** Gün anahtarından bir önceki günün anahtarı. */
export function previousDayKey(key: string): string {
  const [y, m, d] = key.split('-').map(Number)
  return dayKey(new Date(y, m - 1, d - 1, 12))
}

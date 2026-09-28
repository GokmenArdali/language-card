import { fsrs, Rating, type Grade, type IPreview } from 'ts-fsrs'

/** Varsayılan FSRS parametreleri (hedef hatırlama %90, 1dk/10dk öğrenme adımları). */
export const scheduler = fsrs()

export { Rating, State, type Grade } from 'ts-fsrs'

export const GRADES: readonly Grade[] = [Rating.Again, Rating.Hard, Rating.Good, Rating.Easy]

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

/** Bir sonraki tekrara kalan süreyi kısa Türkçe metne çevirir: "1dk", "10dk", "3sa", "4g", "2ay", "1,5y". */
export function formatInterval(ms: number): string {
  // Her birim yuvarlandıktan sonra bir üst birime taşıyorsa ("60dk", "24sa") üst birim kullanılır.
  const minutes = Math.max(1, Math.round(ms / MINUTE))
  if (minutes < 60) return `${minutes}dk`
  const hours = Math.round(ms / HOUR)
  if (hours < 24) return `${hours}sa`
  const days = Math.round(ms / DAY)
  if (days < 30) return `${days}g`
  const months = Math.round(days / 30)
  if (months < 12) return `${months}ay`
  const years = Math.round((days / 365) * 10) / 10
  return `${years.toLocaleString('tr-TR')}y`
}

/** Her not için bir sonraki aralığın etiketi. */
export function intervalLabels(preview: IPreview, now: Date): Record<Grade, string> {
  const label = (g: Grade) => formatInterval(preview[g].card.due.getTime() - now.getTime())
  return {
    [Rating.Again]: label(Rating.Again),
    [Rating.Hard]: label(Rating.Hard),
    [Rating.Good]: label(Rating.Good),
    [Rating.Easy]: label(Rating.Easy),
  } as Record<Grade, string>
}

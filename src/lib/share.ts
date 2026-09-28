export type ShareOutcome = 'shared' | 'downloaded' | 'cancelled' | 'needs-gesture'

/**
 * Dosyayı iOS paylaşım menüsüyle (→ "Dosyalar'a Kaydet") paylaşır; paylaşım desteklenmiyorsa indirir.
 * Safari, `share()` çağrısının bir dokunmaya yakın olmasını ister; veritabanı okuması uzun sürüp bu
 * izin düşerse 'needs-gesture' döner ve kullanıcıdan ikinci bir dokunma istenir.
 */
export async function shareOrDownload(file: File): Promise<ShareOutcome> {
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: file.name })
      return 'shared'
    } catch (e) {
      const name = (e as DOMException)?.name
      if (name === 'AbortError') return 'cancelled'
      if (name === 'NotAllowedError') return 'needs-gesture'
      // Diğer hatalarda indirmeye düş
    }
  }
  download(file)
  return 'downloaded'
}

export function download(file: File) {
  const url = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = url
  a.download = file.name
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

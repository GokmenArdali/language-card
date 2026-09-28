/** Tarayıcıdan verilerin otomatik silinmemesini ister (iOS'ta ana ekran uygulamalarında önemli). */
export async function requestPersistentStorage(): Promise<boolean> {
  if (!navigator.storage?.persist) return false
  try {
    if (await navigator.storage.persisted()) return true
    return await navigator.storage.persist()
  } catch {
    return false
  }
}

import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { getSettings } from '../db/repo.ts'
import type { Settings } from '../db/schema.ts'

/** Dakikada bir ve uygulama öne geldiğinde güncellenen "şimdi". */
export function useNow(intervalMs = 60_000): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const tick = () => setNow(new Date())
    const id = window.setInterval(tick, intervalMs)
    const onVisible = () => document.visibilityState === 'visible' && tick()
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', tick)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', tick)
    }
  }, [intervalMs])
  return now
}

/** Ayarlar (yüklenene kadar undefined). */
export function useSettings(): Settings | undefined {
  return useLiveQuery(getSettings)
}

/** localStorage'a güvenli erişim (gizli mod vb. durumlarda sessizce vazgeçer). */
export const safeStorage = {
  get(key: string): string | null {
    try {
      return localStorage.getItem(key)
    } catch {
      return null
    }
  },
  set(key: string, value: string | null) {
    try {
      if (value == null) localStorage.removeItem(key)
      else localStorage.setItem(key, value)
    } catch {
      /* yok say */
    }
  },
}

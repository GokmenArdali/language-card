import { useEffect, useState } from 'react'

export const ttsSupported = typeof window !== 'undefined' && 'speechSynthesis' in window

function englishVoices(): SpeechSynthesisVoice[] {
  if (!ttsSupported) return []
  return speechSynthesis
    .getVoices()
    .filter((v) => v.lang.replace('_', '-').toLowerCase().startsWith('en'))
    .sort((a, b) => {
      // en-US önce, sonra cihazda yüklü (çevrimdışı çalışan) sesler
      const score = (v: SpeechSynthesisVoice) =>
        (v.lang.replace('_', '-') === 'en-US' ? 0 : 2) + (v.localService ? 0 : 1)
      return score(a) - score(b) || a.name.localeCompare(b.name)
    })
}

/** Ses listesi iOS/Chrome'da gecikmeli yüklenir; değişince güncellenir. */
export function useEnglishVoices(): SpeechSynthesisVoice[] {
  const [voices, setVoices] = useState(englishVoices)
  useEffect(() => {
    if (!ttsSupported) return
    const update = () => setVoices(englishVoices())
    update()
    speechSynthesis.addEventListener('voiceschanged', update)
    return () => speechSynthesis.removeEventListener('voiceschanged', update)
  }, [])
  return voices
}

function pickVoice(voiceURI?: string): SpeechSynthesisVoice | undefined {
  const voices = englishVoices()
  return voices.find((v) => v.voiceURI === voiceURI) ?? voices[0]
}

/**
 * İngilizce metni seslendirir. iOS'ta ilk çağrı bir dokunma olayının içinden yapılmalı
 * (Çevir / 🔊 butonları bu yüzden doğrudan çağırır).
 */
export function speak(text: string, { rate = 0.9, voiceURI }: { rate?: number; voiceURI?: string } = {}) {
  if (!ttsSupported || !text.trim()) return
  speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  const voice = pickVoice(voiceURI)
  if (voice) u.voice = voice
  u.lang = voice?.lang ?? 'en-US'
  u.rate = rate
  speechSynthesis.speak(u)
}

export function stopSpeaking() {
  if (ttsSupported) speechSynthesis.cancel()
}

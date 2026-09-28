import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useRef, useState } from 'react'
import { CardFields, emptyDraft, parseTags, type CardDraft } from '../components/CardFields.tsx'
import { CheckIcon } from '../components/icons.tsx'
import { Screen } from '../components/Screen.tsx'
import { Banner, Button } from '../components/ui.tsx'
import { addCard } from '../db/repo.ts'
import { db } from '../db/schema.ts'
import { dayStart } from '../lib/day.ts'
import { safeStorage } from '../lib/hooks.ts'
import { navigate } from '../lib/router.ts'

const DRAFT_KEY = 'add-draft'

/** Taslak (özellikle kaynak) uygulama kapanıp açılsa da kalsın: iOS arka plandaki PWA'yı kapatabiliyor. */
function loadDraft(): CardDraft {
  try {
    const saved = JSON.parse(safeStorage.get(DRAFT_KEY) ?? 'null')
    return saved ? { ...emptyDraft, ...saved } : emptyDraft
  } catch {
    return emptyDraft
  }
}

const normalize = (s: string) => s.trim().toLocaleLowerCase('tr')

export function AddPage() {
  const [draft, setDraft] = useState<CardDraft>(loadDraft)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const frontRef = useRef<HTMLTextAreaElement | null>(null)

  const addedToday = useLiveQuery(() => db.cards.where('createdAt').aboveOrEqual(dayStart(new Date())).count(), [])

  useEffect(() => {
    safeStorage.set(DRAFT_KEY, JSON.stringify(draft))
  }, [draft])

  useEffect(() => {
    if (!saved) return
    const id = window.setTimeout(() => setSaved(null), 2500)
    return () => window.clearTimeout(id)
  }, [saved])

  async function save(andNew: boolean) {
    if (busy) return
    setError(null)
    if (!draft.front.trim() || !draft.back.trim()) {
      setError('Türkçe ve İngilizce alanları dolu olmalı.')
      return
    }
    setBusy(true)
    try {
      const front = normalize(draft.front)
      const duplicate = await db.cards.filter((c) => normalize(c.front) === front).first()
      if (duplicate && !window.confirm(`Bu Türkçe cümle zaten var:\n“${duplicate.back}”\n\nYine de eklensin mi?`)) return

      await addCard({ ...draft, tags: parseTags(draft.tags) })
      // Kaynak ve etiketler kalır: aynı bölümden art arda kart giriliyor.
      const next = { ...emptyDraft, source: draft.source, tags: draft.tags }
      setDraft(next)
      if (andNew) {
        setSaved(draft.front.trim())
        frontRef.current?.focus()
      } else {
        navigate('cards')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kaydedilemedi.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Screen
      title="Kart ekle"
      action={
        addedToday ? (
          <span className="text-sm text-slate-500 tabular-nums dark:text-slate-400">bugün +{addedToday}</span>
        ) : undefined
      }
    >
      <form
        className="mt-2"
        onSubmit={(e) => {
          e.preventDefault()
          void save(true)
        }}
      >
        <CardFields draft={draft} onChange={setDraft} frontRef={frontRef} onSubmit={() => void save(true)} />

        <div className="mt-4 min-h-12" aria-live="polite">
          {error && <Banner tone="danger">{error}</Banner>}
          {saved && !error && (
            <Banner tone="success" icon={<CheckIcon className="size-5" />}>
              Kaydedildi: <span className="font-normal">{saved}</span>
            </Banner>
          )}
        </div>

        <div className="mt-2 grid grid-cols-[2fr_1fr] gap-3">
          <Button type="submit" disabled={busy}>
            Kaydet ve yeni
          </Button>
          <Button variant="secondary" disabled={busy} onClick={() => void save(false)}>
            Kaydet
          </Button>
        </div>
        {(draft.source || draft.tags) && (
          <button
            type="button"
            onClick={() => setDraft({ ...draft, source: '', tags: '' })}
            className="mt-4 w-full text-center text-sm text-slate-500 underline-offset-2 active:underline dark:text-slate-400"
          >
            Kaynağı ve etiketleri temizle
          </button>
        )}
      </form>
    </Screen>
  )
}

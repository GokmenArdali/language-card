import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { CardFields, parseTags, type CardDraft } from '../components/CardFields.tsx'
import { WarningIcon } from '../components/icons.tsx'
import { Screen } from '../components/Screen.tsx'
import { Banner, Button } from '../components/ui.tsx'
import { deleteCard, updateCard } from '../db/repo.ts'
import { db, type CardRecord } from '../db/schema.ts'
import { dueLabel, stateLabels } from '../lib/cardInfo.ts'
import { useNow } from '../lib/hooks.ts'
import { navigate, useLocation } from '../lib/router.ts'

const toDraft = (c: CardRecord): CardDraft => ({
  front: c.front,
  back: c.back,
  hint: c.hint ?? '',
  source: c.source ?? '',
  tags: c.tags?.join(', ') ?? '',
})

const goBack = () => (window.history.length > 1 ? window.history.back() : navigate('cards'))

export function EditPage() {
  const id = useLocation().params.get('id') ?? ''
  const card = useLiveQuery(() => db.cards.get(id), [id], null)

  if (card === null) return <Screen title="Kartı düzenle" onBack={goBack}>{null}</Screen>
  if (!card)
    return (
      <Screen title="Kart bulunamadı" onBack={() => navigate('cards')}>
        <p className="mt-6 text-slate-500 dark:text-slate-400">Bu kart silinmiş olabilir.</p>
      </Screen>
    )
  return <EditForm key={card.id} card={card} />
}

function EditForm({ card }: { card: CardRecord }) {
  const [draft, setDraft] = useState<CardDraft>(() => toDraft(card))
  const [clearLeech, setClearLeech] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const now = useNow()

  // İçerik başka yerden değişirse (ör. içe aktarma) formu tazele
  const updatedAt = card.updatedAt.getTime()
  const [seenUpdatedAt, setSeenUpdatedAt] = useState(updatedAt)
  if (updatedAt !== seenUpdatedAt) {
    setSeenUpdatedAt(updatedAt)
    setDraft(toDraft(card))
  }

  async function save() {
    setError(null)
    try {
      await updateCard(card.id, { ...draft, tags: parseTags(draft.tags) }, { clearLeech: card.isLeech && clearLeech })
      goBack()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kaydedilemedi.')
    }
  }

  async function remove() {
    if (!window.confirm('Bu kart ve tekrar geçmişi silinsin mi? Bu işlem geri alınamaz.')) return
    await deleteCard(card.id)
    navigate('cards', undefined, { replace: true })
  }

  return (
    <Screen title="Kartı düzenle" onBack={goBack}>
      <form
        className="mt-2"
        onSubmit={(e) => {
          e.preventDefault()
          void save()
        }}
      >
        {card.isLeech && (
          <div className="mb-4 rounded-xl bg-rose-50 p-4 ring-1 ring-rose-200 dark:bg-rose-950/60 dark:ring-rose-900">
            <div className="flex items-center gap-2 font-semibold text-rose-900 dark:text-rose-100">
              <WarningIcon className="size-5" /> Sorunlu kart
            </div>
            <p className="mt-1 text-sm text-rose-800 dark:text-rose-200">
              {card.againCount} kez “Tekrar” aldı. Cümleyi kısalt, ipucu ekle ya da ikiye bölmeyi dene.
            </p>
            <label className="mt-3 flex items-center gap-2 text-sm font-medium text-rose-900 dark:text-rose-100">
              <input
                type="checkbox"
                checked={clearLeech}
                onChange={(e) => setClearLeech(e.target.checked)}
                className="size-5 accent-rose-600"
              />
              Kaydedince sorunlu işaretini kaldır
            </label>
          </div>
        )}

        <CardFields draft={draft} onChange={setDraft} onSubmit={() => void save()} />

        {error && (
          <div className="mt-4">
            <Banner tone="danger">{error}</Banner>
          </div>
        )}

        <Button type="submit" className="mt-6 w-full">
          Kaydet
        </Button>
      </form>

      <dl className="mt-8 grid grid-cols-2 gap-x-4 gap-y-3 rounded-2xl bg-white p-4 text-sm shadow-sm ring-1 ring-slate-200/60 dark:bg-slate-800 dark:ring-slate-700/60">
        <Info label="Durum" value={stateLabels[card.state]} />
        <Info label="Sonraki tekrar" value={dueLabel(card, now)} />
        <Info label="Tekrar sayısı" value={card.reps} />
        <Info label="Unutma (lapses)" value={card.lapses} />
        <Info label="“Tekrar” basılan" value={card.againCount} />
        <Info label="Eklendi" value={card.createdAt.toLocaleDateString('tr-TR')} />
      </dl>

      <Button variant="danger" className="mt-6 w-full" onClick={() => void remove()}>
        Kartı sil
      </Button>
    </Screen>
  )
}

function Info({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <dt className="text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className="font-medium tabular-nums">{value}</dd>
    </div>
  )
}

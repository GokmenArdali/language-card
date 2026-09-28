import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { State } from 'ts-fsrs'
import { BulbIcon, CloseIcon, SpeakerIcon, UndoIcon, WarningIcon } from '../components/icons.tsx'
import { Button } from '../components/ui.tsx'
import { countNewIntroducedToday, getSettings, reviewCard, undoReview, type ReviewResult } from '../db/repo.ts'
import { db, type CardRecord, type Settings } from '../db/schema.ts'
import { GRADES, intervalLabels, Rating, scheduler, type Grade } from '../lib/fsrs.ts'
import { countQueue, newAllowance, pickNext } from '../lib/queue.ts'
import { navigate } from '../lib/router.ts'
import { speak, stopSpeaking, ttsSupported } from '../lib/tts.ts'

interface Session {
  cards: CardRecord[]
  allowance: number
  settings: Settings
}

interface Flip {
  /** Aralıkların hesaplandığı an; notlandırmada da aynısı kullanılır */
  at: Date
  labels: Record<Grade, string>
}

const gradeStyles: Record<Grade, { label: string; cls: string }> = {
  [Rating.Again]: { label: 'Tekrar', cls: 'bg-rose-600 active:bg-rose-700' },
  [Rating.Hard]: { label: 'Zor', cls: 'bg-amber-500 active:bg-amber-600 dark:bg-amber-600 dark:active:bg-amber-700' },
  [Rating.Good]: { label: 'İyi', cls: 'bg-emerald-600 active:bg-emerald-700' },
  [Rating.Easy]: { label: 'Kolay', cls: 'bg-sky-600 active:bg-sky-700' },
}

function replaceCard(cards: CardRecord[], card: CardRecord) {
  return cards.map((c) => (c.id === card.id ? card : c))
}

export function StudyPage() {
  const [session, setSession] = useState<Session | null>(null)
  const [current, setCurrent] = useState<CardRecord | null>(null)
  const [flip, setFlip] = useState<Flip | null>(null)
  const [hintShown, setHintShown] = useState(false)
  const [history, setHistory] = useState<ReviewResult[]>([])
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    void (async () => {
      const [cards, settings, introduced] = await Promise.all([
        db.cards.toArray(),
        getSettings(),
        countNewIntroducedToday(),
      ])
      if (!alive) return
      const allowance = newAllowance(settings.newCardsPerDay, introduced)
      setSession({ cards, allowance, settings })
      setCurrent(pickNext(cards, new Date(), allowance))
    })()
    return () => {
      alive = false
      stopSpeaking()
    }
  }, [])

  useEffect(() => {
    if (!notice) return
    const id = window.setTimeout(() => setNotice(null), 3500)
    return () => window.clearTimeout(id)
  }, [notice])

  const say = useCallback(
    (text: string) => session && speak(text, { rate: session.settings.ttsRate, voiceURI: session.settings.ttsVoiceURI }),
    [session],
  )

  const show = useCallback((card: CardRecord | null) => {
    setCurrent(card)
    setFlip(null)
    setHintShown(false)
    stopSpeaking()
  }, [])

  const doFlip = useCallback(() => {
    if (!current || flip) return
    const at = new Date()
    setFlip({ at, labels: intervalLabels(scheduler.repeat(current, at), at) })
    if (session?.settings.autoSpeak) say(current.back)
  }, [current, flip, session, say])

  const rate = useCallback(
    async (grade: Grade) => {
      if (!session || !current || !flip || busy) return
      setBusy(true)
      try {
        const result = await reviewCard(current.id, grade, flip.at)
        const cards = replaceCard(session.cards, result.card)
        const allowance = session.allowance - (result.previous.state === State.New ? 1 : 0)
        setSession({ ...session, cards, allowance })
        setHistory((h) => [...h, result])
        if (result.becameLeech) setNotice('Bu kart 4. kez “Tekrar” aldı ve sorunlu olarak işaretlendi.')
        show(pickNext(cards, new Date(), allowance))
      } finally {
        setBusy(false)
      }
    },
    [session, current, flip, busy, show],
  )

  const undo = useCallback(async () => {
    const last = history.at(-1)
    if (!session || !last || busy) return
    setBusy(true)
    try {
      await undoReview(last)
      setSession({
        ...session,
        cards: replaceCard(session.cards, last.previous),
        allowance: session.allowance + (last.previous.state === State.New ? 1 : 0),
      })
      setHistory((h) => h.slice(0, -1))
      show(last.previous)
    } finally {
      setBusy(false)
    }
  }, [history, session, busy, show])

  // Klavye (masaüstünde deneme için): Boşluk = çevir, 1-4 = not, Z = geri al
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if ((e.key === ' ' || e.key === 'Enter') && !flip) {
        e.preventDefault()
        doFlip()
      } else if (flip && ['1', '2', '3', '4'].includes(e.key)) {
        void rate(Number(e.key) as Grade)
      } else if (e.key.toLowerCase() === 'z') {
        void undo()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [flip, doFlip, rate, undo])

  const counts = useMemo(
    () => (session ? countQueue(session.cards, new Date(), session.allowance) : null),
    [session, current],
  )

  const close = () => {
    stopSpeaking()
    navigate('home')
  }

  return (
    <div className="study-surface pt-safe flex h-full flex-col">
      <div className="px-safe flex h-14 shrink-0 items-center justify-between">
        <IconButton label="Oturumu kapat" onClick={close}>
          <CloseIcon className="size-6" />
        </IconButton>
        {counts && current && (
          <div className="flex gap-4 text-sm font-semibold tabular-nums">
            <span className="text-sky-600 dark:text-sky-400" title="Bekleyen tekrar">
              Tekrar {counts.due}
            </span>
            <span className="text-emerald-600 dark:text-emerald-400" title="Yeni kart">
              Yeni {counts.fresh}
            </span>
          </div>
        )}
        <IconButton label="Son cevabı geri al" onClick={() => void undo()} disabled={!history.length || busy}>
          <UndoIcon className="size-6" />
        </IconButton>
      </div>

      {!session ? null : current ? (
        <>
          <main
            className="px-safe min-h-0 flex-1 overflow-y-auto"
            onClick={() => !flip && doFlip()}
            aria-live="polite"
          >
            <div className="mx-auto flex min-h-full max-w-lg flex-col justify-center py-6 text-center">
              {current.isLeech && (
                <span className="mx-auto mb-4 inline-flex items-center gap-1 rounded-full bg-rose-100 px-3 py-1 text-xs font-medium text-rose-700 dark:bg-rose-950 dark:text-rose-300">
                  <WarningIcon className="size-3.5" /> Sorunlu kart
                </span>
              )}
              {current.state === State.New && (
                <span className="mx-auto mb-4 rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                  Yeni kart
                </span>
              )}
              <p lang="tr" className="text-3xl leading-tight font-semibold text-balance break-words">
                {current.front}
              </p>

              {current.hint && (
                <div className="mt-5 min-h-10">
                  {hintShown || flip ? (
                    <p lang="en" className="text-lg text-amber-700 italic dark:text-amber-300">
                      {current.hint}
                    </p>
                  ) : (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setHintShown(true)
                      }}
                      className="inline-flex h-10 items-center gap-1.5 rounded-full bg-amber-100 px-4 text-sm font-medium text-amber-800 active:bg-amber-200 dark:bg-amber-950 dark:text-amber-200"
                    >
                      <BulbIcon className="size-4" /> İpucu
                    </button>
                  )}
                </div>
              )}

              {flip && (
                <>
                  <hr className="my-7 border-slate-200 dark:border-slate-700" />
                  <p
                    lang="en"
                    className="text-3xl leading-tight font-semibold text-balance break-words text-indigo-700 dark:text-indigo-300"
                  >
                    {current.back}
                  </p>
                  {ttsSupported && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        say(current.back)
                      }}
                      aria-label="Seslendir"
                      className="mx-auto mt-5 grid size-14 place-items-center rounded-full bg-indigo-100 text-indigo-700 active:bg-indigo-200 dark:bg-indigo-950 dark:text-indigo-300"
                    >
                      <SpeakerIcon className="size-7" />
                    </button>
                  )}
                  {current.source && (
                    <p className="mt-5 text-sm text-slate-400 dark:text-slate-500">{current.source}</p>
                  )}
                </>
              )}
            </div>
          </main>

          <footer className="px-safe pb-safe shrink-0 pt-2">
            <div className="mx-auto max-w-lg pb-3">
              {notice && (
                <p className="mb-2 rounded-xl bg-rose-600 px-4 py-2 text-center text-sm font-medium text-white">
                  {notice}
                </p>
              )}
              {!flip ? (
                <>
                  <p className="mb-2 text-center text-sm text-slate-500 dark:text-slate-400">
                    Önce sesli söyle, sonra çevir
                  </p>
                  <button
                    type="button"
                    onClick={doFlip}
                    className="h-16 w-full rounded-2xl bg-slate-900 text-lg font-semibold text-white active:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:active:bg-slate-300"
                  >
                    Çevir
                  </button>
                </>
              ) : (
                <div className="grid grid-cols-4 gap-2">
                  {GRADES.map((g) => (
                    <button
                      key={g}
                      type="button"
                      disabled={busy}
                      onClick={() => void rate(g)}
                      className={`flex h-16 flex-col items-center justify-center rounded-2xl text-white ${gradeStyles[g].cls}`}
                    >
                      <span className="text-base font-semibold">{gradeStyles[g].label}</span>
                      <span className="text-xs font-medium tabular-nums opacity-90">{flip.labels[g]}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </footer>
        </>
      ) : (
        <Summary history={history} learningLater={counts?.learningLater ?? 0} onClose={close} />
      )}
    </div>
  )
}

function IconButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className="grid size-11 place-items-center rounded-full text-slate-500 active:bg-slate-200 disabled:opacity-30 dark:text-slate-400 dark:active:bg-slate-800"
    >
      {children}
    </button>
  )
}

function Summary({
  history,
  learningLater,
  onClose,
}: {
  history: ReviewResult[]
  learningLater: number
  onClose: () => void
}) {
  const cards = new Set(history.map((r) => r.card.id)).size
  const answers = history.length
  const correct = history.filter((r) => r.log.rating !== Rating.Again).length
  const fresh = history.filter((r) => r.previous.state === State.New).length
  const pct = answers ? Math.round((correct / answers) * 100) : 0

  return (
    <div className="px-safe pb-safe flex flex-1 flex-col">
      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center text-center">
        <div className="text-6xl" aria-hidden="true">
          {answers ? '🎉' : '☕'}
        </div>
        <h1 className="mt-4 text-3xl font-bold">{answers ? 'Oturum bitti' : 'Bugünlük bitti'}</h1>
        {answers ? (
          <div className="mt-8 grid grid-cols-3 gap-3">
            <Stat label="Kart" value={cards} />
            <Stat label="Doğru" value={`${correct}/${answers}`} />
            <Stat label="Başarı" value={`%${pct}`} />
          </div>
        ) : (
          <p className="mt-3 text-slate-500 dark:text-slate-400">Şu an çalışılacak kart yok.</p>
        )}
        {fresh > 0 && (
          <p className="mt-4 text-slate-500 dark:text-slate-400">{fresh} yeni kart öğrenmeye başladın.</p>
        )}
        {learningLater > 0 && (
          <p className="mt-2 text-slate-500 dark:text-slate-400">
            {learningLater} kart bugün biraz sonra tekrar gelecek.
          </p>
        )}
      </div>
      <div className="mx-auto w-full max-w-lg pb-4">
        <Button className="h-14 w-full text-lg" onClick={onClose}>
          Ana sayfaya dön
        </Button>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200/60 dark:bg-slate-800 dark:ring-slate-700/60">
      <div className="text-2xl font-bold tabular-nums">{value}</div>
      <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">{label}</div>
    </div>
  )
}

import { useLiveQuery } from 'dexie-react-hooks'
import { FlameIcon, WarningIcon } from '../components/icons.tsx'
import { Screen } from '../components/Screen.tsx'
import { Banner, Button } from '../components/ui.tsx'
import { countNewIntroducedToday, countReviewsToday, getSettings, getStreak } from '../db/repo.ts'
import { db } from '../db/schema.ts'
import { dayStart } from '../lib/day.ts'
import { useNow } from '../lib/hooks.ts'
import { countQueue, newAllowance } from '../lib/queue.ts'
import { navigate } from '../lib/router.ts'

const BACKUP_WARN_DAYS = 7
const DAY_MS = 24 * 60 * 60 * 1000

export function HomePage() {
  const now = useNow()
  const today = dayStart(now).getTime()

  const data = useLiveQuery(async () => {
    const at = new Date()
    const [cards, settings, introduced, reviewsToday, streak] = await Promise.all([
      db.cards.toArray(),
      getSettings(),
      countNewIntroducedToday(at),
      countReviewsToday(at),
      getStreak(at),
    ])
    return { cards, settings, introduced, reviewsToday, streak }
  }, [today])

  if (!data) return <Screen title="Bugün">{null}</Screen>

  const { cards, settings, introduced, reviewsToday, streak } = data
  const counts = countQueue(cards, now, newAllowance(settings.newCardsPerDay, introduced))
  const leeches = cards.filter((c) => c.isLeech).length
  const canStudy = counts.due + counts.fresh > 0

  const backupAgeDays = settings.lastBackupAt
    ? Math.floor((now.getTime() - settings.lastBackupAt.getTime()) / DAY_MS)
    : null
  const needsBackup = cards.length > 0 && (backupAgeDays === null || backupAgeDays > BACKUP_WARN_DAYS)

  return (
    <Screen
      title="Bugün"
      action={
        <span
          className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-semibold tabular-nums ${
            streak.studiedToday
              ? 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300'
              : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
          }`}
          title={streak.studiedToday ? 'Bugün çalıştın' : 'Seriyi sürdürmek için bugün çalış'}
        >
          <FlameIcon className="size-4" />
          {streak.days} gün
        </span>
      }
    >
      <div className="mt-2 space-y-2">
        {needsBackup && (
          <Banner
            tone="warning"
            icon={<WarningIcon className="size-5" />}
            onClick={() => navigate('settings', { section: 'backup' })}
          >
            {backupAgeDays === null
              ? 'Henüz hiç yedek almadın.'
              : `Son yedeğin üzerinden ${backupAgeDays} gün geçti.`}{' '}
            <span className="underline">Şimdi yedekle</span>
          </Banner>
        )}
        {leeches > 0 && (
          <Banner
            tone="danger"
            icon={<WarningIcon className="size-5" />}
            onClick={() => navigate('cards', { filter: 'leech' })}
          >
            Düzeltilmesi gereken {leeches} kart var. <span className="underline">Göster</span>
          </Banner>
        )}
      </div>

      {cards.length === 0 ? (
        <div className="mt-16 text-center">
          <div className="text-5xl" aria-hidden="true">
            🗂️
          </div>
          <p className="mt-4 text-lg font-medium">Henüz kart yok</p>
          <p className="mt-1 text-slate-500 dark:text-slate-400">İzlediğin diziden ilk cümleyi ekleyerek başla.</p>
          <Button className="mt-6 h-14 w-full text-lg" onClick={() => navigate('add')}>
            İlk kartı ekle
          </Button>
        </div>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Stat label="Tekrar" value={counts.due} tone="text-sky-600 dark:text-sky-400" />
            <Stat label="Yeni" value={counts.fresh} tone="text-emerald-600 dark:text-emerald-400" />
          </div>

          <Button className="mt-5 h-16 w-full text-xl" disabled={!canStudy} onClick={() => navigate('study')}>
            {canStudy ? 'Başla' : 'Bugünlük bitti ✓'}
          </Button>

          {!canStudy && (
            <p className="mt-3 text-center text-sm text-slate-500 dark:text-slate-400">
              {counts.learningLater > 0
                ? `${counts.learningLater} kart birazdan tekrar hazır olacak.`
                : counts.totalNew > 0
                  ? 'Günlük yeni kart limiti doldu. Yarın devam!'
                  : 'Yeni kart ekleyebilirsin.'}
            </p>
          )}

          <dl className="mt-8 grid grid-cols-3 gap-3 text-center">
            <MiniStat label="bugün tekrar" value={reviewsToday} />
            <MiniStat label="bekleyen yeni" value={counts.totalNew} />
            <MiniStat label="toplam kart" value={cards.length} />
          </dl>
        </>
      )}
    </Screen>
  )
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200/60 dark:bg-slate-800 dark:ring-slate-700/60">
      <div className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</div>
      <div className={`mt-1 text-4xl font-bold tabular-nums ${tone}`}>{value}</div>
    </div>
  )
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col-reverse">
      <dt className="text-xs text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className="text-xl font-semibold tabular-nums">{value}</dd>
    </div>
  )
}

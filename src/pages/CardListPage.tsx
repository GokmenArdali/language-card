import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState, type ReactNode } from 'react'
import { ChevronRightIcon, SearchIcon, WarningIcon } from '../components/icons.tsx'
import { Screen } from '../components/Screen.tsx'
import { Button, inputClass } from '../components/ui.tsx'
import { db, type CardRecord } from '../db/schema.ts'
import { dueLabel, matchesSearch } from '../lib/cardInfo.ts'
import { useNow } from '../lib/hooks.ts'
import { navigate, useLocation } from '../lib/router.ts'

const PAGE = 100

type Filter = 'all' | 'leech'

export function CardListPage() {
  const { params } = useLocation()
  const filter: Filter = params.get('filter') === 'leech' ? 'leech' : 'all'
  const [query, setQuery] = useState('')
  const [limit, setLimit] = useState(PAGE)
  const now = useNow()

  const cards = useLiveQuery(() => db.cards.orderBy('createdAt').reverse().toArray(), [])
  const leechCount = useMemo(() => cards?.filter((c) => c.isLeech).length ?? 0, [cards])

  const visible = useMemo(() => {
    if (!cards) return []
    return cards.filter((c) => (filter === 'leech' ? c.isLeech : true) && matchesSearch(c, query))
  }, [cards, filter, query])

  const setFilter = (f: Filter) => {
    setLimit(PAGE)
    navigate('cards', f === 'leech' ? { filter: 'leech' } : undefined, { replace: true })
  }

  return (
    <Screen
      title="Kartlar"
      action={
        cards && <span className="text-sm text-slate-500 tabular-nums dark:text-slate-400">{cards.length} kart</span>
      }
    >
      <div className="sticky top-0 z-10 -mx-4 bg-slate-50/95 px-4 pt-1 pb-3 backdrop-blur dark:bg-slate-900/95">
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setLimit(PAGE)
            }}
            placeholder="Ara (Türkçe, İngilizce, kaynak…)"
            enterKeyHint="search"
            autoCapitalize="off"
            autoCorrect="off"
            className={`${inputClass} pl-11`}
          />
        </div>
        <div className="mt-3 flex gap-2" role="tablist">
          <Chip active={filter === 'all'} onClick={() => setFilter('all')}>
            Tümü
          </Chip>
          <Chip active={filter === 'leech'} onClick={() => setFilter('leech')} tone="danger">
            Sorunlu kartlar{leechCount > 0 && ` (${leechCount})`}
          </Chip>
        </div>
      </div>

      {cards && cards.length === 0 && (
        <div className="mt-12 text-center">
          <p className="text-slate-500 dark:text-slate-400">Henüz kart yok.</p>
          <Button className="mt-4" onClick={() => navigate('add')}>
            İlk kartı ekle
          </Button>
        </div>
      )}

      {cards && cards.length > 0 && visible.length === 0 && (
        <p className="mt-12 text-center text-slate-500 dark:text-slate-400">
          {filter === 'leech' && !query ? 'Sorunlu kart yok. 👏' : 'Eşleşen kart yok.'}
        </p>
      )}

      {filter === 'leech' && visible.length > 0 && (
        <p className="mb-3 px-1 text-sm text-slate-500 dark:text-slate-400">
          Bu kartlar 4 ya da daha fazla kez “Tekrar” aldı. Cümleyi sadeleştir, ipucu ekle ya da ikiye böl; kaydederken
          sorunlu işareti kalkar.
        </p>
      )}

      <ul className="divide-y divide-slate-200 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/60 empty:hidden dark:divide-slate-700 dark:bg-slate-800 dark:ring-slate-700/60">
        {visible.slice(0, limit).map((card) => (
          <CardRow key={card.id} card={card} now={now} />
        ))}
      </ul>

      {visible.length > limit && (
        <Button variant="ghost" className="mt-3 w-full" onClick={() => setLimit(limit + PAGE)}>
          Daha fazla göster ({visible.length - limit})
        </Button>
      )}
    </Screen>
  )
}

function Chip({
  active,
  onClick,
  tone,
  children,
}: {
  active: boolean
  onClick: () => void
  tone?: 'danger'
  children: ReactNode
}) {
  const activeCls =
    tone === 'danger'
      ? 'bg-rose-600 text-white dark:bg-rose-500'
      : 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`h-9 rounded-full px-4 text-sm font-medium ${
        active ? activeCls : 'bg-white text-slate-700 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700'
      }`}
    >
      {children}
    </button>
  )
}

function CardRow({ card, now }: { card: CardRecord; now: Date }) {
  return (
    <li>
      <button
        type="button"
        onClick={() => navigate('edit', { id: card.id })}
        className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-slate-100 dark:active:bg-slate-700"
      >
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium">{card.front}</div>
          <div className="truncate text-slate-500 dark:text-slate-400" lang="en">
            {card.back}
          </div>
          <div className="mt-1 flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500">
            {card.isLeech && (
              <span className="inline-flex items-center gap-1 font-medium text-rose-600 dark:text-rose-400">
                <WarningIcon className="size-3.5" /> Sorunlu
              </span>
            )}
            <span>{dueLabel(card, now)}</span>
            {card.source && <span className="truncate">· {card.source}</span>}
          </div>
        </div>
        <ChevronRightIcon className="size-5 shrink-0 text-slate-300 dark:text-slate-600" />
      </button>
    </li>
  )
}

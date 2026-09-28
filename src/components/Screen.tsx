import type { ReactNode } from 'react'
import { BackIcon } from './icons.tsx'

/** Başlık + kaydırılabilir içerik. Üst çentik boşluğunu başlık karşılar. */
export function Screen({
  title,
  action,
  onBack,
  children,
}: {
  title: string
  action?: ReactNode
  onBack?: () => void
  children: ReactNode
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="pt-safe px-safe shrink-0 bg-slate-50/90 backdrop-blur dark:bg-slate-900/90">
        <div className="mx-auto flex h-14 max-w-lg items-center gap-1">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              aria-label="Geri"
              className="-ml-2 grid size-11 place-items-center rounded-full text-indigo-600 active:bg-slate-200 dark:text-indigo-400 dark:active:bg-slate-800"
            >
              <BackIcon className="size-6" />
            </button>
          )}
          <h1 className="flex-1 truncate text-2xl font-bold tracking-tight">{title}</h1>
          {action}
        </div>
      </header>
      <main className="px-safe min-h-0 flex-1 overflow-y-auto overscroll-contain pb-8">
        <div className="mx-auto max-w-lg">{children}</div>
      </main>
    </div>
  )
}

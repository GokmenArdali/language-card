import type { ComponentType, SVGProps } from 'react'
import { navigate, type Route } from '../lib/router.ts'
import { HomeIcon, ListIcon, PlusIcon, SlidersIcon } from './icons.tsx'

const tabs: { route: Route; label: string; Icon: ComponentType<SVGProps<SVGSVGElement>> }[] = [
  { route: 'home', label: 'Ana sayfa', Icon: HomeIcon },
  { route: 'add', label: 'Ekle', Icon: PlusIcon },
  { route: 'cards', label: 'Kartlar', Icon: ListIcon },
  { route: 'settings', label: 'Ayarlar', Icon: SlidersIcon },
]

export function TabBar({ current }: { current: Route }) {
  return (
    <nav className="pb-safe shrink-0 border-t border-slate-200 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95">
      <ul className="mx-auto flex max-w-lg">
        {tabs.map(({ route, label, Icon }) => {
          const active = route === current
          return (
            <li key={route} className="flex-1">
              <button
                type="button"
                onClick={() => navigate(route)}
                aria-current={active ? 'page' : undefined}
                className={`flex h-14 w-full flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${
                  active ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                <Icon className="size-6" />
                {label}
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

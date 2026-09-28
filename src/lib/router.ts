import { useMemo, useSyncExternalStore } from 'react'

export type Route = 'home' | 'study' | 'add' | 'cards' | 'edit' | 'settings'

const routes: readonly Route[] = ['home', 'study', 'add', 'cards', 'edit', 'settings']

export interface Location {
  route: Route
  params: URLSearchParams
}

function parse(hash: string): Location {
  const [path, query = ''] = hash.replace(/^#\/?/, '').split('?')
  const route = (routes as readonly string[]).includes(path) ? (path as Route) : 'home'
  return { route, params: new URLSearchParams(query) }
}

function subscribe(onChange: () => void) {
  window.addEventListener('hashchange', onChange)
  return () => window.removeEventListener('hashchange', onChange)
}

/** Hash tabanlı yönlendirme (#/cards?filter=leech): statik barındırmada 404 sorunu çıkarmaz. */
export function useLocation(): Location {
  const hash = useSyncExternalStore(subscribe, () => window.location.hash)
  return useMemo(() => parse(hash), [hash])
}

export function href(route: Route, params?: Record<string, string>): string {
  const query = params ? `?${new URLSearchParams(params)}` : ''
  return `#/${route === 'home' ? '' : route}${query}`
}

export function navigate(route: Route, params?: Record<string, string>, { replace = false } = {}) {
  const target = href(route, params)
  if (replace) window.location.replace(target)
  else window.location.hash = target
}

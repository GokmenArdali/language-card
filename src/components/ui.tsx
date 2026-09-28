import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost'

const variants: Record<Variant, string> = {
  primary: 'bg-indigo-600 text-white active:bg-indigo-700 disabled:bg-indigo-600/40',
  secondary:
    'bg-white text-slate-900 ring-1 ring-slate-200 active:bg-slate-100 dark:bg-slate-800 dark:text-slate-100 dark:ring-slate-700 dark:active:bg-slate-700',
  danger:
    'bg-white text-rose-600 ring-1 ring-rose-200 active:bg-rose-50 dark:bg-slate-800 dark:text-rose-400 dark:ring-rose-900 dark:active:bg-rose-950',
  ghost: 'text-indigo-600 active:bg-indigo-50 dark:text-indigo-400 dark:active:bg-slate-800',
}

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type="button"
      className={`inline-flex h-12 items-center justify-center gap-2 rounded-xl px-4 text-base font-semibold transition-colors disabled:cursor-not-allowed ${variants[variant]} ${className}`}
      {...props}
    />
  )
}

export function Section({ title, children, id }: { title?: string; children: ReactNode; id?: string }) {
  return (
    <section id={id} className="mt-6 scroll-mt-4">
      {title && (
        <h2 className="mb-2 px-1 text-sm font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
          {title}
        </h2>
      )}
      <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200/60 dark:bg-slate-800 dark:ring-slate-700/60">
        {children}
      </div>
    </section>
  )
}

type Tone = 'warning' | 'danger' | 'success' | 'info'

const tones: Record<Tone, string> = {
  warning: 'bg-amber-50 text-amber-900 ring-amber-200 dark:bg-amber-950/60 dark:text-amber-100 dark:ring-amber-900',
  danger: 'bg-rose-50 text-rose-900 ring-rose-200 dark:bg-rose-950/60 dark:text-rose-100 dark:ring-rose-900',
  success:
    'bg-emerald-50 text-emerald-900 ring-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-100 dark:ring-emerald-900',
  info: 'bg-indigo-50 text-indigo-900 ring-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-100 dark:ring-indigo-900',
}

export function Banner({
  tone,
  icon,
  children,
  onClick,
}: {
  tone: Tone
  icon?: ReactNode
  children: ReactNode
  onClick?: () => void
}) {
  const cls = `flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-medium ring-1 ${tones[tone]}`
  const content = (
    <>
      {icon && <span className="shrink-0">{icon}</span>}
      <span className="flex-1">{children}</span>
    </>
  )
  return onClick ? (
    <button type="button" onClick={onClick} className={cls}>
      {content}
    </button>
  ) : (
    <div role="status" className={cls}>
      {content}
    </div>
  )
}

export function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  description?: string
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4">
      <span>
        <span className="block font-medium">{label}</span>
        {description && <span className="block text-sm text-slate-500 dark:text-slate-400">{description}</span>}
      </span>
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="peer sr-only"
      />
      <span
        aria-hidden="true"
        className="relative h-8 w-13 shrink-0 rounded-full bg-slate-300 transition-colors peer-checked:bg-emerald-500 peer-focus-visible:ring-2 peer-focus-visible:ring-indigo-500 after:absolute after:top-1 after:left-1 after:size-6 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:after:translate-x-5 dark:bg-slate-600"
      />
    </label>
  )
}

export const inputClass =
  'block w-full rounded-xl border-0 bg-white px-4 py-3 text-base text-slate-900 ring-1 ring-slate-200 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500 focus:outline-none dark:bg-slate-800 dark:text-slate-100 dark:ring-slate-700 dark:placeholder:text-slate-500'

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-baseline justify-between px-1 text-sm font-medium text-slate-600 dark:text-slate-300">
        {label}
        {hint && <span className="text-xs font-normal text-slate-400">{hint}</span>}
      </span>
      {children}
    </label>
  )
}

import { useEffect, useRef, type KeyboardEvent, type RefObject } from 'react'
import { Field, inputClass } from './ui.tsx'

export interface CardDraft {
  front: string
  back: string
  hint: string
  source: string
  tags: string
}

export const emptyDraft: CardDraft = { front: '', back: '', hint: '', source: '', tags: '' }

export const parseTags = (s: string) =>
  s
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)

/** İçeriğe göre uzayan metin alanı. Enter bir sonraki alana geçer (Shift+Enter yeni satır). */
function AutoTextarea({
  value,
  onChange,
  inputRef,
  onEnter,
  ...rest
}: {
  value: string
  onChange: (v: string) => void
  inputRef?: RefObject<HTMLTextAreaElement | null>
  onEnter?: () => void
  placeholder?: string
  lang?: string
  autoCapitalize?: string
  enterKeyHint?: 'next' | 'done'
  required?: boolean
}) {
  const ref = useRef<HTMLTextAreaElement | null>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [value])

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && onEnter) {
      e.preventDefault()
      onEnter()
    }
  }

  return (
    <textarea
      ref={(el) => {
        ref.current = el
        if (inputRef) inputRef.current = el
      }}
      rows={2}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={onKeyDown}
      className={`${inputClass} resize-none text-lg leading-snug`}
      {...rest}
    />
  )
}

export function CardFields({
  draft,
  onChange,
  frontRef,
  onSubmit,
}: {
  draft: CardDraft
  onChange: (d: CardDraft) => void
  frontRef?: RefObject<HTMLTextAreaElement | null>
  /** Son alanda Enter'a basılınca */
  onSubmit?: () => void
}) {
  const backRef = useRef<HTMLTextAreaElement | null>(null)
  const hintRef = useRef<HTMLInputElement | null>(null)
  const set = (key: keyof CardDraft) => (v: string) => onChange({ ...draft, [key]: v })

  return (
    <div className="space-y-4">
      <Field label="Türkçe" hint="ön yüz">
        <AutoTextarea
          inputRef={frontRef}
          value={draft.front}
          onChange={set('front')}
          onEnter={() => backRef.current?.focus()}
          placeholder="Koşmak zorundayım."
          lang="tr"
          autoCapitalize="sentences"
          enterKeyHint="next"
          required
        />
      </Field>
      <Field label="İngilizce" hint="arka yüz">
        <AutoTextarea
          inputRef={backRef}
          value={draft.back}
          onChange={set('back')}
          onEnter={() => hintRef.current?.focus()}
          placeholder="I have to run."
          lang="en"
          autoCapitalize="sentences"
          enterKeyHint="next"
          required
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="İpucu" hint="isteğe bağlı">
          <input
            ref={hintRef}
            value={draft.hint}
            onChange={(e) => set('hint')(e.target.value)}
            placeholder="run…"
            lang="en"
            autoCapitalize="off"
            enterKeyHint="done"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && onSubmit) {
                e.preventDefault()
                onSubmit()
              }
            }}
            className={inputClass}
          />
        </Field>
        <Field label="Kaynak" hint="isteğe bağlı">
          <input
            value={draft.source}
            onChange={(e) => set('source')(e.target.value)}
            placeholder="Friends S1E3"
            autoCapitalize="words"
            className={inputClass}
          />
        </Field>
      </div>
      <Field label="Etiketler" hint="virgülle ayır">
        <input
          value={draft.tags}
          onChange={(e) => set('tags')(e.target.value)}
          placeholder="fiil, günlük"
          autoCapitalize="off"
          className={inputClass}
        />
      </Field>
    </div>
  )
}

import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from 'react'
import { Screen } from '../components/Screen.tsx'
import { Banner, Button, Section, Toggle, inputClass } from '../components/ui.tsx'
import {
  backupFileName,
  createBackup,
  importBackup,
  importCsv,
  parseBackup,
  serializeBackup,
  type BackupFile,
  type ImportMode,
} from '../db/backup.ts'
import { updateSettings } from '../db/repo.ts'
import { db, type Settings } from '../db/schema.ts'
import { useSettings } from '../lib/hooks.ts'
import { useLocation } from '../lib/router.ts'
import { shareOrDownload } from '../lib/share.ts'
import { requestPersistentStorage } from '../lib/storage.ts'
import { speak, ttsSupported, useEnglishVoices } from '../lib/tts.ts'

type Message = { tone: 'success' | 'danger' | 'info'; text: string }

export function SettingsPage() {
  const settings = useSettings()
  const { params } = useLocation()

  useEffect(() => {
    if (!settings) return
    const section = params.get('section')
    if (section) document.getElementById(section)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [params, settings])

  return (
    <Screen title="Ayarlar">
      {settings && (
        <>
          <StudySettings settings={settings} />
          <SpeechSettings settings={settings} />
          <BackupSettings settings={settings} />
          <StorageInfo />
        </>
      )}
    </Screen>
  )
}

function StudySettings({ settings }: { settings: Settings }) {
  const set = (n: number) => void updateSettings({ newCardsPerDay: Math.max(0, Math.min(100, n)) })
  return (
    <Section title="Çalışma">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="font-medium">Günlük yeni kart</div>
          <div className="text-sm text-slate-500 dark:text-slate-400">Limit dolunca yeni kart gelmez</div>
        </div>
        <div className="flex items-center gap-1">
          <StepButton label="Azalt" onClick={() => set(settings.newCardsPerDay - 1)}>
            −
          </StepButton>
          <span className="w-10 text-center text-xl font-semibold tabular-nums">{settings.newCardsPerDay}</span>
          <StepButton label="Artır" onClick={() => set(settings.newCardsPerDay + 1)}>
            +
          </StepButton>
        </div>
      </div>
    </Section>
  )
}

function StepButton({ label, onClick, children }: { label: string; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="grid size-11 place-items-center rounded-full bg-slate-100 text-2xl leading-none font-medium active:bg-slate-200 dark:bg-slate-700 dark:active:bg-slate-600"
    >
      {children}
    </button>
  )
}

function SpeechSettings({ settings }: { settings: Settings }) {
  const voices = useEnglishVoices()
  if (!ttsSupported)
    return (
      <Section title="Seslendirme">
        <p className="text-slate-500 dark:text-slate-400">Bu tarayıcı seslendirmeyi desteklemiyor.</p>
      </Section>
    )

  return (
    <Section title="Seslendirme">
      <Toggle
        label="Otomatik seslendir"
        description="Kart çevrilince İngilizcesi okunur"
        checked={settings.autoSpeak}
        onChange={(autoSpeak) => void updateSettings({ autoSpeak })}
      />
      <hr className="my-4 border-slate-200 dark:border-slate-700" />
      <label className="block">
        <span className="flex justify-between font-medium">
          Hız <span className="tabular-nums text-slate-500 dark:text-slate-400">{settings.ttsRate.toFixed(2)}×</span>
        </span>
        <input
          type="range"
          min={0.5}
          max={1.3}
          step={0.05}
          value={settings.ttsRate}
          onChange={(e) => void updateSettings({ ttsRate: Number(e.target.value) })}
          className="mt-3 w-full accent-indigo-600"
        />
      </label>
      {voices.length > 1 && (
        <label className="mt-4 block">
          <span className="mb-1.5 block font-medium">Ses</span>
          <select
            value={settings.ttsVoiceURI ?? ''}
            onChange={(e) => void updateSettings({ ttsVoiceURI: e.target.value || undefined })}
            className={inputClass}
          >
            <option value="">Otomatik (en-US)</option>
            {voices.map((v) => (
              <option key={v.voiceURI} value={v.voiceURI}>
                {v.name} ({v.lang})
              </option>
            ))}
          </select>
        </label>
      )}
      <Button
        variant="secondary"
        className="mt-4 w-full"
        onClick={() =>
          speak('I have to run, or I will miss the train.', {
            rate: settings.ttsRate,
            voiceURI: settings.ttsVoiceURI,
          })
        }
      >
        🔊 Dene
      </Button>
    </Section>
  )
}

function formatDate(d: Date) {
  return d.toLocaleString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function BackupSettings({ settings }: { settings: Settings }) {
  const [message, setMessage] = useState<Message | null>(null)
  const [busy, setBusy] = useState(false)
  const [pendingFile, setPendingFile] = useState<{ file: File; at: Date } | null>(null)
  const [pendingImport, setPendingImport] = useState<BackupFile | null>(null)
  const jsonInput = useRef<HTMLInputElement>(null)
  const csvInput = useRef<HTMLInputElement>(null)

  async function finishShare(file: File, at: Date) {
    const outcome = await shareOrDownload(file)
    if (outcome === 'needs-gesture') {
      setPendingFile({ file, at })
      return
    }
    setPendingFile(null)
    if (outcome === 'cancelled') {
      setMessage({ tone: 'info', text: 'Yedekleme iptal edildi.' })
      return
    }
    await updateSettings({ lastBackupAt: at })
    setMessage({
      tone: 'success',
      text: outcome === 'shared' ? 'Yedek paylaşıldı. Dosyalar\'a kaydettiysen hazır.' : `İndirildi: ${file.name}`,
    })
  }

  async function exportNow() {
    setBusy(true)
    setMessage(null)
    try {
      const at = new Date()
      const backup = await createBackup(at)
      // Dosyadan geri yüklenince "son yedek" bu an olarak görünsün
      backup.settings.lastBackupAt = at
      const json = serializeBackup(backup)
      const file = new File([json], backupFileName(at), { type: 'application/json' })
      await finishShare(file, at)
    } catch (e) {
      setMessage({ tone: 'danger', text: `Yedek alınamadı: ${(e as Error).message}` })
    } finally {
      setBusy(false)
    }
  }

  async function onJsonPicked(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setMessage(null)
    try {
      setPendingImport(parseBackup(await file.text()))
    } catch (err) {
      setMessage({ tone: 'danger', text: (err as Error).message })
    }
  }

  async function runImport(mode: ImportMode) {
    if (!pendingImport) return
    if (
      mode === 'replace' &&
      !window.confirm('Cihazdaki TÜM kartlar, tekrar geçmişi ve ayarlar silinip yedektekiyle değiştirilecek. Emin misin?')
    )
      return
    setBusy(true)
    try {
      const r = await importBackup(pendingImport, mode)
      setMessage({
        tone: 'success',
        text:
          mode === 'replace'
            ? `Yedek yüklendi: ${r.cardsAdded} kart, ${r.logsAdded} tekrar kaydı.`
            : `Birleştirildi: ${r.cardsAdded} yeni kart, ${r.cardsUpdated} kart güncellendi, ${r.logsAdded} tekrar kaydı eklendi.`,
      })
      setPendingImport(null)
    } catch (e) {
      setMessage({ tone: 'danger', text: `İçe aktarılamadı: ${(e as Error).message}` })
    } finally {
      setBusy(false)
    }
  }

  async function onCsvPicked(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setBusy(true)
    setMessage(null)
    try {
      const r = await importCsv(await file.text())
      const parts = [`${r.added} kart eklendi`]
      if (r.duplicates) parts.push(`${r.duplicates} kopya atlandı`)
      if (r.invalid) parts.push(`${r.invalid} satır eksik olduğu için atlandı`)
      setMessage({ tone: r.added ? 'success' : 'info', text: `${parts.join(', ')}.` })
    } catch (err) {
      setMessage({ tone: 'danger', text: `CSV okunamadı: ${(err as Error).message}` })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Section title="Yedekleme" id="backup">
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Son yedek:{' '}
        <span className="font-medium text-slate-700 dark:text-slate-200">
          {settings.lastBackupAt ? formatDate(settings.lastBackupAt) : 'hiç alınmadı'}
        </span>
      </p>

      <Button className="mt-3 w-full" disabled={busy} onClick={() => void exportNow()}>
        Yedeği dışa aktar (JSON)
      </Button>
      {pendingFile && (
        <Button
          variant="secondary"
          className="mt-2 w-full"
          onClick={() => void finishShare(pendingFile.file, pendingFile.at)}
        >
          Hazır — kaydetmek için dokun
        </Button>
      )}
      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
        Paylaşım menüsünde “Dosyalar’a Kaydet”i seç. Tüm kartlar, tekrar geçmişi ve ayarlar tek dosyada.
      </p>

      <hr className="my-4 border-slate-200 dark:border-slate-700" />

      <Button variant="secondary" className="w-full" disabled={busy} onClick={() => jsonInput.current?.click()}>
        Yedekten geri yükle…
      </Button>
      <input
        ref={jsonInput}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => void onJsonPicked(e)}
      />

      {pendingImport && (
        <div className="mt-3 rounded-xl bg-slate-100 p-4 dark:bg-slate-900">
          <p className="text-sm">
            <span className="font-semibold">{pendingImport.cards.length} kart</span>,{' '}
            {pendingImport.logs.length} tekrar kaydı
            {pendingImport.exportedAt.getTime() > 0 && <> · {formatDate(pendingImport.exportedAt)}</>}
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button disabled={busy} onClick={() => void runImport('merge')}>
              Birleştir
            </Button>
            <Button variant="danger" disabled={busy} onClick={() => void runImport('replace')}>
              Üzerine yaz
            </Button>
          </div>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            Birleştir: mevcut kartlar kalır, yeniler eklenir; aynı kartın daha güncel hâli seçilir. Üzerine yaz:
            cihazdaki her şey silinir, yedek aynen yüklenir.
          </p>
          <button
            type="button"
            className="mt-2 w-full py-2 text-sm text-slate-500"
            onClick={() => setPendingImport(null)}
          >
            Vazgeç
          </button>
        </div>
      )}

      <Button variant="secondary" className="mt-3 w-full" disabled={busy} onClick={() => csvInput.current?.click()}>
        CSV’den kart ekle…
      </Button>
      <input
        ref={csvInput}
        type="file"
        accept=".csv,text/csv,text/comma-separated-values,text/plain"
        className="hidden"
        onChange={(e) => void onCsvPicked(e)}
      />
      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
        Sütunlar: <code>front,back,hint,source</code> (başlık satırı isteğe bağlı; virgül ya da noktalı virgül).
        Aynı Türkçe+İngilizce kartlar atlanır.
      </p>

      {message && (
        <div className="mt-4" aria-live="polite">
          <Banner tone={message.tone}>{message.text}</Banner>
        </div>
      )}
    </Section>
  )
}

function StorageInfo() {
  const [persisted, setPersisted] = useState<boolean | null>(null)
  const counts = useLiveQuery(async () => ({ cards: await db.cards.count(), logs: await db.logs.count() }), [])

  useEffect(() => {
    void navigator.storage?.persisted?.().then(setPersisted)
  }, [])

  return (
    <Section title="Depolama">
      <dl className="space-y-2 text-sm">
        <Row label="Kart" value={counts?.cards ?? '…'} />
        <Row label="Tekrar kaydı" value={counts?.logs ?? '…'} />
        <Row
          label="Kalıcı depolama"
          value={persisted == null ? 'bilinmiyor' : persisted ? 'açık' : 'kapalı'}
          action={
            persisted === false ? (
              <button
                type="button"
                className="ml-2 text-indigo-600 dark:text-indigo-400"
                onClick={() => void requestPersistentStorage().then(setPersisted)}
              >
                İste
              </button>
            ) : undefined
          }
        />
      </dl>
      <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
        Veriler yalnızca bu cihazda tutulur. Uygulamayı ana ekrandan silmek verileri de siler — düzenli yedek al.
      </p>
      <p className="mt-3 text-xs text-slate-400 dark:text-slate-500">Sürüm {__APP_VERSION__}</p>
    </Section>
  )
}

function Row({ label, value, action }: { label: string; value: string | number; action?: ReactNode }) {
  return (
    <div className="flex justify-between">
      <dt className="text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className="font-medium tabular-nums">
        {value}
        {action}
      </dd>
    </div>
  )
}

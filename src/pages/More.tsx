import { useRef, useState } from 'react'
import { InstallHint } from '../components/InstallHint'
import { Card, Choice, Collapsible, Field, Group, Stepper } from '../components/ui'
import { createBackup, parseBackup, shareOrDownload } from '../lib/backup'
import { ATTACK_PRIORITIES, RULES, SKILLS } from '../lib/content'
import { actions, useData } from '../lib/store'
import { toast } from '../lib/toast'
import type { Bracket, Settings } from '../lib/types'

const BRACKET_OPTIONS = ([1, 2, 3, 4, 5] as Bracket[]).map((b) => ({ id: b, label: String(b) }))

export function More() {
  const data = useData()
  const [settings, setSettings] = useState<Settings>(data.settings)
  const fileInput = useRef<HTMLInputElement>(null)
  const dirty = JSON.stringify(settings) !== JSON.stringify(data.settings)

  const set = <K extends keyof Settings>(key: K, v: Settings[K]) => setSettings({ ...settings, [key]: v })

  const saveSettings = () => {
    actions.updateSettings({ ...settings, defaultDeck: settings.defaultDeck.trim() || data.settings.defaultDeck })
    toast('Einstellungen gespeichert.')
  }

  const exportBackup = async () => {
    await shareOrDownload(createBackup(data, __APP_VERSION__))
  }

  const importBackup = async (file: File) => {
    try {
      const imported = parseBackup(await file.text())
      const changed = actions.importData(imported)
      toast(changed === 0 ? 'Backup eingelesen. Nichts Neues dabei.' : `${changed} Runden übernommen.`)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Backup konnte nicht gelesen werden.')
    }
  }

  return (
    <div className="page">
      <header className="page-header">
        <h1>Mehr</h1>
      </header>

      <Card>
        <h2>Einstellungen</h2>
        <div className="form">
          <Field label="Standard-Deck" hint="Für neue Runden und den Upgrade-Fahrplan">
            <input value={settings.defaultDeck} onChange={(e) => set('defaultDeck', e.target.value)} />
          </Field>
          <Group label="Bracket">
            <Choice
              options={BRACKET_OPTIONS}
              value={settings.defaultBracket}
              onChange={(v) => v && set('defaultBracket', v)}
              columns={5}
            />
          </Group>
          <Group label="Spieler am Tisch">
            <Stepper
              label="Spieler"
              value={settings.defaultPlayers}
              min={2}
              max={8}
              onChange={(v) => v && set('defaultPlayers', v)}
            />
          </Group>
          <Field label="Dein Satz am Tisch" hint="Wird vor jeder Runde angezeigt">
            <textarea rows={2} value={settings.tableIntro} onChange={(e) => set('tableIntro', e.target.value)} />
          </Field>
          <button type="button" className="primary" disabled={!dirty} onClick={saveSettings}>
            Speichern
          </button>
        </div>
      </Card>

      <Card>
        <h2>Backup</h2>
        <p className="muted">
          Deine Runden liegen nur auf diesem Handy. Sichere sie ab und zu, z. B. in iCloud Drive
          oder Google Drive. So kannst du sie auch auf ein neues Gerät mitnehmen.
        </p>
        <div className="actions">
          <button type="button" className="secondary" onClick={() => void exportBackup()}>
            Backup sichern
          </button>
          <button type="button" className="secondary" onClick={() => fileInput.current?.click()}>
            Backup einspielen
          </button>
        </div>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0]
            e.target.value = ''
            if (file) void importBackup(file)
          }}
        />
      </Card>

      <Card>
        <h2>Spickzettel</h2>
        <Collapsible title="Fokus-Rotation">
          <ol>
            {SKILLS.map((s) => (
              <li key={s.id}>
                <strong>{s.name}:</strong> {s.tip}
              </li>
            ))}
          </ol>
        </Collapsible>
        <Collapsible title="Wen angreifen?">
          <ol>
            {ATTACK_PRIORITIES.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ol>
        </Collapsible>
        <Collapsible title="Regeln">
          <dl className="rules">
            {RULES.map((r) => (
              <div key={r.title}>
                <dt>{r.title}</dt>
                <dd>{r.text}</dd>
              </div>
            ))}
          </dl>
        </Collapsible>
      </Card>

      <InstallHint always />

      <p className="muted small center">
        Endstep v{__APP_VERSION__} ({__APP_COMMIT__})
      </p>
    </div>
  )
}

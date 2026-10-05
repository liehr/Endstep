import {
  BookOpenIcon,
  CalculatorIcon,
  CaretLeftIcon,
  CaretRightIcon,
  ChatCircleDotsIcon,
  DeviceMobileIcon,
  DownloadSimpleIcon,
  StackIcon,
  UploadSimpleIcon,
  UsersThreeIcon,
  type Icon,
} from '@phosphor-icons/react'
import { useRef, useState, type CSSProperties } from 'react'
import { GhaltaCalculator } from '../components/GhaltaCalculator'
import { InstallSteps } from '../components/InstallHint'
import { AttackList, RulesList } from '../components/Reference'
import { SkillBadge } from '../components/skills'
import { BottomSheet, Button, Choice, Field, Group, IconButton, Stepper } from '../components/ui'
import { createBackup, parseBackup, shareOrDownload } from '../lib/backup'
import { SKILLS } from '../lib/content'
import { isStandalone } from '../lib/install'
import { navigate } from '../lib/route'
import { actions, useData } from '../lib/store'
import { toast } from '../lib/toast'
import type { Bracket, Settings } from '../lib/types'

const BRACKET_OPTIONS = ([1, 2, 3, 4, 5] as Bracket[]).map((b) => ({ id: b, label: String(b) }))

type SheetId = 'deck' | 'table' | 'intro' | 'install' | null

function Row({
  icon: IconCmp,
  color,
  label,
  value,
  onClick,
}: {
  icon: Icon
  color: string
  label: string
  value?: string
  onClick: () => void
}) {
  return (
    <li>
      <button type="button" className="settings-row" onClick={onClick}>
        <span className="settings-icon" style={{ '--c': color } as CSSProperties} aria-hidden="true">
          <IconCmp weight="fill" />
        </span>
        <span className="settings-label">{label}</span>
        {value && <span className="settings-value">{value}</span>}
        <CaretRightIcon weight="bold" className="settings-caret" aria-hidden="true" />
      </button>
    </li>
  )
}

export function More() {
  const data = useData()
  const { settings } = data
  const [sheet, setSheet] = useState<SheetId>(null)
  const [draft, setDraft] = useState<Settings>(settings)
  const fileInput = useRef<HTMLInputElement>(null)

  const open = (id: SheetId) => {
    setDraft(settings)
    setSheet(id)
  }
  const save = () => {
    actions.updateSettings({ ...draft, defaultDeck: draft.defaultDeck.trim() || settings.defaultDeck })
    setSheet(null)
    toast('Gespeichert')
  }

  const importBackup = async (file: File) => {
    try {
      const changed = actions.importData(parseBackup(await file.text()))
      toast(changed === 0 ? 'Nichts Neues im Backup' : `${changed} Runden übernommen`)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Backup konnte nicht gelesen werden')
    }
  }

  return (
    <div className="screen">
      <header className="screen-header">
        <h1>Mehr</h1>
      </header>

      <section className="list-group">
        <h2 className="list-title">Dein Deck</h2>
        <ul className="list settings">
          <Row icon={StackIcon} color="var(--skill-combat)" label="Standard-Deck" value={settings.defaultDeck} onClick={() => open('deck')} />
          <Row
            icon={UsersThreeIcon}
            color="var(--skill-sequencing)"
            label="Tisch"
            value={`Bracket ${settings.defaultBracket} · ${settings.defaultPlayers} Spieler`}
            onClick={() => open('table')}
          />
          <Row icon={ChatCircleDotsIcon} color="var(--skill-politics)" label="Ansage am Tisch" onClick={() => open('intro')} />
        </ul>
      </section>

      <section className="list-group">
        <h2 className="list-title">Werkzeuge</h2>
        <ul className="list settings">
          <Row icon={BookOpenIcon} color="var(--skill-mulligan)" label="Spickzettel" onClick={() => navigate('/mehr/spickzettel')} />
          <Row icon={CalculatorIcon} color="var(--brand)" label="Ghalta-Rechner" onClick={() => navigate('/mehr/ghalta')} />
        </ul>
      </section>

      <section className="list-group">
        <h2 className="list-title">Daten</h2>
        <ul className="list settings">
          <Row
            icon={DownloadSimpleIcon}
            color="var(--skill-sequencing)"
            label="Backup sichern"
            onClick={() => void shareOrDownload(createBackup(data, __APP_VERSION__))}
          />
          <Row icon={UploadSimpleIcon} color="var(--skill-sequencing)" label="Backup einspielen" onClick={() => fileInput.current?.click()} />
        </ul>
        <p className="list-footnote">
          Deine Runden liegen nur auf diesem Handy. Sichere sie ab und zu, z. B. in iCloud Drive oder Google Drive.
        </p>
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
      </section>

      {!isStandalone() && (
        <section className="list-group">
          <h2 className="list-title">App</h2>
          <ul className="list settings">
            <Row icon={DeviceMobileIcon} color="var(--brand)" label="Als App installieren" onClick={() => setSheet('install')} />
          </ul>
        </section>
      )}

      <p className="muted small center">
        Endstep v{__APP_VERSION__} ({__APP_COMMIT__})
      </p>

      <BottomSheet open={sheet === 'deck'} onClose={() => setSheet(null)} title="Standard-Deck">
        <Field label="Name" hint="Für neue Runden und die Upgrade-Truhe">
          <input value={draft.defaultDeck} onChange={(e) => setDraft({ ...draft, defaultDeck: e.target.value })} />
        </Field>
        <Button block onClick={save}>
          Speichern
        </Button>
      </BottomSheet>

      <BottomSheet open={sheet === 'table'} onClose={() => setSheet(null)} title="Tisch">
        <Group label="Bracket">
          <Choice
            options={BRACKET_OPTIONS}
            value={draft.defaultBracket}
            columns={5}
            onChange={(v) => v && setDraft({ ...draft, defaultBracket: v })}
          />
        </Group>
        <Group label="Spieler am Tisch">
          <Stepper
            label="Spieler"
            value={draft.defaultPlayers}
            min={2}
            max={8}
            onChange={(v) => v && setDraft({ ...draft, defaultPlayers: v })}
          />
        </Group>
        <Button block onClick={save}>
          Speichern
        </Button>
      </BottomSheet>

      <BottomSheet open={sheet === 'intro'} onClose={() => setSheet(null)} title="Ansage am Tisch">
        <Field label="Dein Satz vor jeder Runde">
          <textarea rows={3} value={draft.tableIntro} onChange={(e) => setDraft({ ...draft, tableIntro: e.target.value })} />
        </Field>
        <Button block onClick={save}>
          Speichern
        </Button>
      </BottomSheet>

      <BottomSheet open={sheet === 'install'} onClose={() => setSheet(null)} title="Als App installieren">
        <InstallSteps />
      </BottomSheet>
    </div>
  )
}

export function CheatSheet() {
  return (
    <div className="screen">
      <header className="screen-header">
        <IconButton icon={CaretLeftIcon} label="Zurück" onClick={() => history.back()} />
      </header>
      <h1>Spickzettel</h1>

      <section className="panel">
        <h2>Fokus-Rotation</h2>
        <ul className="skill-list">
          {SKILLS.map((s) => (
            <li key={s.id}>
              <SkillBadge id={s.id} size={40} />
              <div>
                <strong>{s.name}</strong>
                <p>{s.tip}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="panel">
        <h2>Wen angreifen?</h2>
        <AttackList />
      </section>

      <section className="panel">
        <h2>Regeln</h2>
        <RulesList />
      </section>
    </div>
  )
}

export function GhaltaPage() {
  return (
    <div className="screen">
      <header className="screen-header">
        <IconButton icon={CaretLeftIcon} label="Zurück" onClick={() => history.back()} />
      </header>
      <h1>Ghalta-Rechner</h1>
      <GhaltaCalculator />
      <p className="muted small">
        Die Commander-Steuer (+2 je Cast aus der Command Zone) wird zuerst addiert, dann senkt die Gesamtstärke deiner
        Kreaturen den generischen Teil.
      </p>
    </div>
  )
}

import {
  BookOpenIcon,
  CalculatorIcon,
  CardsIcon,
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
import { deckSize } from '../lib/decklist'
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
    toast('Saved')
  }

  const importBackup = async (file: File) => {
    try {
      const changed = actions.importData(parseBackup(await file.text()))
      toast(changed === 0 ? 'Nothing new in the backup' : `${changed} ${changed === 1 ? 'game' : 'games'} imported`)
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't read the backup")
    }
  }

  return (
    <div className="screen">
      <header className="screen-header">
        <h1>More</h1>
      </header>

      <section className="list-group">
        <h2 className="list-title">Your deck</h2>
        <ul className="list settings">
          <Row icon={CardsIcon} color="var(--skill-mulligan)" label="Decklist & swaps" value={`${deckSize(data.decklist)} + 1`} onClick={() => navigate('/mehr/deck')} />
          <Row icon={StackIcon} color="var(--skill-combat)" label="Deck name" value={settings.defaultDeck} onClick={() => open('deck')} />
          <Row
            icon={UsersThreeIcon}
            color="var(--skill-sequencing)"
            label="Table"
            value={`Bracket ${settings.defaultBracket} · ${settings.defaultPlayers} players`}
            onClick={() => open('table')}
          />
          <Row icon={ChatCircleDotsIcon} color="var(--skill-politics)" label="Table talk" onClick={() => open('intro')} />
        </ul>
      </section>

      <section className="list-group">
        <h2 className="list-title">Tools</h2>
        <ul className="list settings">
          <Row icon={BookOpenIcon} color="var(--skill-mulligan)" label="Cheat sheet" onClick={() => navigate('/mehr/spickzettel')} />
          <Row icon={CalculatorIcon} color="var(--brand)" label="Ghalta calculator" onClick={() => navigate('/mehr/ghalta')} />
        </ul>
      </section>

      <section className="list-group">
        <h2 className="list-title">Data</h2>
        <ul className="list settings">
          <Row
            icon={DownloadSimpleIcon}
            color="var(--skill-sequencing)"
            label="Save backup"
            onClick={() => void shareOrDownload(createBackup(data, __APP_VERSION__))}
          />
          <Row icon={UploadSimpleIcon} color="var(--skill-sequencing)" label="Restore backup" onClick={() => fileInput.current?.click()} />
        </ul>
        <p className="list-footnote">
          Your games are only stored on this phone. Back them up now and then, e.g. to iCloud Drive or Google Drive.
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
            <Row icon={DeviceMobileIcon} color="var(--brand)" label="Install as app" onClick={() => setSheet('install')} />
          </ul>
        </section>
      )}

      <p className="muted small center">
        Endstep v{__APP_VERSION__} ({__APP_COMMIT__})
      </p>

      <BottomSheet open={sheet === 'deck'} onClose={() => setSheet(null)} title="Deck name">
        <Field label="Name" hint="For new games and the upgrade chest">
          <input value={draft.defaultDeck} onChange={(e) => setDraft({ ...draft, defaultDeck: e.target.value })} />
        </Field>
        <Button block onClick={save}>
          Save
        </Button>
      </BottomSheet>

      <BottomSheet open={sheet === 'table'} onClose={() => setSheet(null)} title="Table">
        <Group label="Bracket">
          <Choice
            options={BRACKET_OPTIONS}
            value={draft.defaultBracket}
            columns={5}
            onChange={(v) => v && setDraft({ ...draft, defaultBracket: v })}
          />
        </Group>
        <Group label="Players at the table">
          <Stepper
            label="Players"
            value={draft.defaultPlayers}
            min={2}
            max={8}
            onChange={(v) => v && setDraft({ ...draft, defaultPlayers: v })}
          />
        </Group>
        <Button block onClick={save}>
          Save
        </Button>
      </BottomSheet>

      <BottomSheet open={sheet === 'intro'} onClose={() => setSheet(null)} title="Table talk">
        <Field label="What you say before each game">
          <textarea rows={3} value={draft.tableIntro} onChange={(e) => setDraft({ ...draft, tableIntro: e.target.value })} />
        </Field>
        <Button block onClick={save}>
          Save
        </Button>
      </BottomSheet>

      <BottomSheet open={sheet === 'install'} onClose={() => setSheet(null)} title="Install as app">
        <InstallSteps />
      </BottomSheet>
    </div>
  )
}

export function CheatSheet() {
  return (
    <div className="screen">
      <header className="screen-header">
        <IconButton icon={CaretLeftIcon} label="Back" onClick={() => history.back()} />
      </header>
      <h1>Cheat sheet</h1>

      <section className="panel">
        <h2>Focus rotation</h2>
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
        <h2>Who to attack?</h2>
        <AttackList />
      </section>

      <section className="panel">
        <h2>Rules</h2>
        <RulesList />
      </section>
    </div>
  )
}

export function GhaltaPage() {
  return (
    <div className="screen">
      <header className="screen-header">
        <IconButton icon={CaretLeftIcon} label="Back" onClick={() => history.back()} />
      </header>
      <h1>Ghalta calculator</h1>
      <GhaltaCalculator />
      <p className="muted small">
        The commander tax (+2 per cast from the command zone) is added first, then the total power of your creatures
        reduces the generic part.
      </p>
    </div>
  )
}

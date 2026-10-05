import { CaretLeftIcon } from '@phosphor-icons/react'
import { useState } from 'react'
import { Button, Choice, ConfirmSheet, Group, IconButton, type ChoiceOption } from '../components/ui'
import {
  BRACKET_CHECK_OPTIONS,
  EXAM_HEART_OPTIONS,
  LESSON_LENGTHS,
  MISTAKE_DAY_OPTIONS,
  PATTERN_OPTIONS,
  UPGRADE_EVERY_OPTIONS,
} from '../lib/content'
import { defaultSettings, resetPreferences } from '../lib/data'
import { actions, useData } from '../lib/store'
import { toast } from '../lib/toast'
import { DAILY_GOALS } from '../lib/trainingStreak'
import type { Settings, Theme } from '../lib/types'

const THEME_OPTIONS: ChoiceOption<Theme>[] = [
  { id: 'system', label: 'System' },
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
]

type BoolKey = { [K in keyof Settings]: Settings[K] extends boolean ? K : never }[keyof Settings]
type NumberKey = { [K in keyof Settings]: Settings[K] extends number ? K : never }[keyof Settings]

/** Everything you can tune in the app, grouped like the app itself. Changes apply right away. */
export function SettingsPage() {
  const { settings } = useData()
  const defaults = defaultSettings()
  const [confirmReset, setConfirmReset] = useState(false)

  const update = (patch: Partial<Settings>) => actions.updateSettings({ ...settings, ...patch })

  const toggle = (key: BoolKey, on = 'On', off = 'Off') => (
    <Choice
      options={[
        { id: 'on', label: on },
        { id: 'off', label: off },
      ]}
      value={settings[key] ? 'on' : 'off'}
      onChange={(v) => v && update({ [key]: v === 'on' })}
    />
  )

  /** Number choices; the default gets a small "default" note. */
  const numbers = (key: NumberKey, values: readonly number[], label: (n: number) => string) => (
    <Choice
      options={values.map((n) => ({ id: n, label: label(n), hint: n === defaults[key] ? 'default' : undefined }))}
      value={settings[key]}
      columns={values.length}
      onChange={(v) => v !== null && update({ [key]: v })}
    />
  )

  return (
    <div className="screen">
      <header className="screen-header">
        <IconButton icon={CaretLeftIcon} label="Back" onClick={() => history.back()} />
      </header>
      <h1>Settings</h1>

      <section className="panel">
        <h2>Look & feel</h2>
        <Group label="Theme">
          <Choice options={THEME_OPTIONS} value={settings.theme} columns={3} onChange={(v) => v && update({ theme: v })} />
        </Group>
        <Group label="Vibration" hint="Short buzz on taps and answers. Android only; iPhones don’t allow it in web apps.">
          {toggle('haptics')}
        </Group>
        <Group label="Celebrations" hint="Confetti after a win, a good lesson or a promotion.">
          {toggle('celebrations')}
        </Group>
        <Group label="Dice button" hint="The floating dice on every screen.">
          {toggle('diceButton', 'Show', 'Hide')}
        </Group>
      </section>

      <section className="panel">
        <h2>Training</h2>
        <Group label="Daily goal" hint="Lessons per day for your training streak.">
          {numbers('dailyGoal', DAILY_GOALS, (n) => String(n))}
        </Group>
        <Group label="Daily goal on Home">{toggle('showDailyGoal', 'Show', 'Hide')}</Group>
        <Group label="Questions per lesson" hint="Rank lessons count with 80% or more right.">
          {numbers('lessonLength', LESSON_LENGTHS, (n) => String(n))}
        </Group>
        <Group label="Warm-up tips" hint="Marks the lesson that trains your next game’s focus.">
          {toggle('warmUps')}
        </Group>
        <Group label="Your Mistakes looks back" hint="Wrong answers and game decisions from this many days.">
          {numbers('mistakeDays', MISTAKE_DAY_OPTIONS, (n) => `${n} days`)}
        </Group>
        <Group label="Hearts in the rank exam" hint="How many wrong answers the exam allows.">
          {numbers('examHearts', EXAM_HEART_OPTIONS, (n) => String(n))}
        </Group>
      </section>

      <section className="panel">
        <h2>Games & deck</h2>
        <Group label="Upgrade chest every" hint="Games between swap rounds.">
          {numbers('upgradeEvery', UPGRADE_EVERY_OPTIONS, (n) => String(n))}
        </Group>
        <Group label="Bracket check after" hint="Games until the app asks your group about a higher bracket.">
          {numbers('bracketCheckGames', BRACKET_CHECK_OPTIONS, (n) => (n === 0 ? 'Off' : String(n)))}
        </Group>
        <Group label="Pattern after" hint="How often a dead card or a skill mistake must come up before the app calls it a pattern.">
          {numbers('patternThreshold', PATTERN_OPTIONS, (n) => `${n}×`)}
        </Group>
        <p className="muted small">Deck name, bracket, players and table talk are under More → Your deck.</p>
      </section>

      <Button block variant="secondary" onClick={() => setConfirmReset(true)}>
        Reset to defaults
      </Button>

      <ConfirmSheet
        open={confirmReset}
        title="Reset settings?"
        text="Everything on this page goes back to how the app started. Your games, deck, table and progress stay."
        confirmLabel="Reset"
        onConfirm={() => {
          actions.updateSettings(resetPreferences(settings))
          setConfirmReset(false)
          toast('Settings reset')
        }}
        onClose={() => setConfirmReset(false)}
      />
    </div>
  )
}

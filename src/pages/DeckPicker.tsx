import { CaretLeftIcon, CaretRightIcon, ClipboardTextIcon, LinkIcon, UploadSimpleIcon } from '@phosphor-icons/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { BottomSheet, Button, Field, IconButton } from '../components/ui'
import { parseBackup } from '../lib/backup'
import { cardKey } from '../lib/cards'
import { shortName } from '../lib/commander'
import type { ChosenDeck } from '../lib/data'
import { linkHint } from '../lib/deckSources'
import { deckCardNames, deckSize, parseDecklist } from '../lib/decklist'
import { fetchPreconDeck, searchPrecons, type Precon, type PreconDeck } from '../lib/precons'
import { navigate } from '../lib/route'
import { ensureCards } from '../lib/scryfall'
import { actions, useData } from '../lib/store'
import { toast } from '../lib/toast'

const year = (p: Precon) => p.released.slice(0, 4)

function startWith(deck: ChosenDeck) {
  actions.chooseDeck(deck)
  void ensureCards([{ name: deck.commander, set: deck.commanderSet }, ...deck.decklist])
  toast(`Let’s play ${deck.name}!`)
  navigate('/', { replace: true })
}

/**
 * Pick the deck the app is tailored to: search a precon or paste your own list.
 * Shown on first launch (welcome) and when switching decks later.
 */
export function DeckPicker({ welcome = false }: { welcome?: boolean }) {
  const { settings } = useData()
  const [query, setQuery] = useState('')
  // Without a query only the newest few, so your own list stays in view.
  const results = useMemo(() => searchPrecons(query, undefined, query.trim() ? 30 : 8), [query])
  const [picked, setPicked] = useState<Precon | null>(null)
  const [pasting, setPasting] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  const restore = async (file: File) => {
    try {
      const backup = parseBackup(await file.text())
      actions.importData(backup)
      if (backup.deckChosen) {
        toast('Backup restored')
        navigate('/', { replace: true })
      } else toast('The backup has no deck yet. Pick one here.')
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't read the backup")
    }
  }

  return (
    <div className="screen">
      {welcome ? (
        <div className="intro">
          <img src={`${import.meta.env.BASE_URL}pwa-192x192.png`} alt="" className="mascot" />
          <h1>Which deck do you play?</h1>
          <p className="lead">Lessons, stats and swaps follow this deck. You can switch any time.</p>
        </div>
      ) : (
        <>
          <header className="screen-header">
            <IconButton icon={CaretLeftIcon} label="Back" onClick={() => navigate('/mehr/deck')} />
          </header>
          <div>
            <h1>Play a different deck</h1>
            <p className="muted">
              Your games stay. Stats, swaps and the upgrade chest follow the active deck, now {settings.defaultDeck}.
            </p>
          </div>
        </>
      )}

      <Field label="Search a precon" hint="Deck name, commander, set code or year">
        <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="e.g. Tramplesaurus or Ghalta" />
      </Field>

      <section className="list-group">
        <h2 className="list-title">{query.trim() ? 'Precons' : 'Newest precons'}</h2>
        {results.length === 0 ? (
          <p className="muted small">No precon found. You can paste your list below.</p>
        ) : (
          <ul className="list">
            {results.map((p) => (
              <li key={p.file}>
                <button type="button" className="deck-row" onClick={() => setPicked(p)}>
                  <span className="deck-name">
                    {p.name}
                    <small className="muted small">
                      {p.commanders.join(' & ')} · {p.set.toUpperCase()} · {year(p)}
                    </small>
                  </span>
                  <CaretRightIcon weight="bold" className="settings-caret" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel stack">
        <h2>Your own list</h2>
        <p className="muted small">From Moxfield, Archidekt, MTGGoldfish or any text list with one card per line.</p>
        <Button variant="secondary" icon={ClipboardTextIcon} onClick={() => setPasting(true)}>
          Paste a decklist
        </Button>
      </section>

      {welcome && (
        <>
          <Button variant="ghost" size="sm" icon={UploadSimpleIcon} onClick={() => fileInput.current?.click()}>
            Restore a backup
          </Button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0]
              e.target.value = ''
              if (file) void restore(file)
            }}
          />
        </>
      )}
      <p className="muted small center">Precon lists: MTGJSON. Card data: Scryfall.</p>

      <PreconSheet precon={picked} onClose={() => setPicked(null)} />
      <PasteSheet open={pasting} onClose={() => setPasting(false)} />
    </div>
  )
}

type Loaded = { status: 'loading' } | { status: 'error'; error: string } | { status: 'ready'; deck: PreconDeck }

function PreconSheet({ precon, onClose }: { precon: Precon | null; onClose: () => void }) {
  const [state, setState] = useState<Loaded>({ status: 'loading' })
  const file = precon?.file

  useEffect(() => {
    if (!file) return
    let active = true
    setState({ status: 'loading' })
    fetchPreconDeck(file).then(
      (deck) => active && setState({ status: 'ready', deck }),
      (err: unknown) => active && setState({ status: 'error', error: err instanceof Error ? err.message : String(err) }),
    )
    return () => {
      active = false
    }
  }, [file])

  if (!precon) return null
  const play = () => {
    if (state.status !== 'ready') return
    const { deck } = state
    startWith({
      name: `${precon.name} (${shortName(deck.commander)})`,
      commander: deck.commander,
      commanderSet: deck.commanderSet,
      decklist: deck.entries,
      precon: precon.file,
    })
  }

  return (
    <BottomSheet open onClose={onClose} title={precon.name}>
      <p>
        <strong>{precon.commanders.join(' & ')}</strong>
      </p>
      <p className="muted small">
        Commander precon · {precon.set.toUpperCase()} · {year(precon)}
        {state.status === 'ready' && ` · ${deckSize(state.deck.entries)} + 1 cards`}
      </p>
      {precon.commanders.length > 1 && (
        <p className="muted small">Two commanders: for now the app tracks the first one, the partner counts as part of the 99.</p>
      )}
      {state.status === 'error' && <p className="error-text small">{state.error}</p>}
      <Button block disabled={state.status !== 'ready'} onClick={play}>
        {state.status === 'loading' ? 'Loading decklist…' : 'Play this deck'}
      </Button>
    </BottomSheet>
  )
}

function PasteSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [text, setText] = useState('')
  const [picked, setPicked] = useState('')
  const [name, setName] = useState('')
  const hint = linkHint(text)
  const parsed = useMemo(() => parseDecklist(text), [text])
  const commander = parsed.commander ?? picked
  const entries = parsed.entries
    .map((e) => (cardKey(e.name) === cardKey(commander) ? { ...e, qty: e.qty - 1 } : e))
    .filter((e) => e.qty > 0)
  const size = deckSize(entries)
  const candidates = parsed.commander ? [] : deckCardNames(parsed.entries)

  const play = () => {
    const commanderSet = parsed.commander ? parsed.commanderSet : (parsed.entries.find((e) => cardKey(e.name) === cardKey(commander))?.set ?? null)
    startWith({ name: name.trim() || commander, commander, commanderSet, decklist: entries, precon: null })
  }

  return (
    <BottomSheet open={open} onClose={onClose} title="Paste a decklist">
      <p className="muted small">
        Export the list as text and paste it here, e.g. “1 Sol Ring”. Links can’t be read directly, because Moxfield and
        Archidekt don’t share decks with other apps.
      </p>
      <textarea
        rows={8}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={'Commander\n1 Your Commander\n\nDeck\n1 Sol Ring\n1 Command Tower\n…'}
      />
      {hint ? (
        <p className="callout small">
          <LinkIcon weight="bold" aria-hidden="true" /> {hint.site ? `That’s a ${hint.site} link. ` : ''}
          {hint.steps}
        </p>
      ) : (
        text.trim() && (
          <>
            {candidates.length > 0 && (
              <Field label="Which card is your commander?" hint="The list has no Commander section.">
                <select value={picked} onChange={(e) => setPicked(e.target.value)}>
                  <option value="">Choose…</option>
                  {candidates.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            <p className={size === 99 ? 'muted small' : 'error-text small'}>
              {size} cards recognized{commander ? `, Commander: ${commander}` : ''}.
              {size !== 99 && ' A Commander deck has 99 cards plus the commander.'}
              {parsed.errors.length > 0 && ` Not understood: ${parsed.errors.slice(0, 3).join(' | ')}`}
            </p>
            <Field label="Deck name">
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder={commander || 'Deck name'} />
            </Field>
          </>
        )
      )}
      <Button block disabled={!!hint || !commander || size === 0} onClick={play}>
        Play this deck
      </Button>
    </BottomSheet>
  )
}

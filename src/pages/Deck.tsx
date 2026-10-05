import {
  ArrowClockwiseIcon,
  ArrowCounterClockwiseIcon,
  ArrowsLeftRightIcon,
  CaretLeftIcon,
  CheckIcon,
  ClipboardTextIcon,
  CloudArrowDownIcon,
  CopyIcon,
  MagnifyingGlassIcon,
  SwapIcon,
  WarningIcon,
  XIcon,
} from '@phosphor-icons/react'
import { useEffect, useMemo, useState } from 'react'
import { CardImage } from '../components/CardImage'
import { BottomSheet, Button, ConfirmSheet, Field, IconButton } from '../components/ui'
import { cardKey, isArtifact, isCreature, isLand, type CardInfo } from '../lib/cards'
import { formatDate } from '../lib/dates'
import { UPGRADE_EVERY_GAMES } from '../lib/content'
import {
  deckCardNames,
  deckSize,
  isBasicLand,
  parseDecklist,
  serializeDecklist,
} from '../lib/decklist'
import { shortName } from '../lib/commander'
import { haptic } from '../lib/haptics'
import { fetchCommanderPage, parseSuggestions, type Suggestion } from '../lib/edhrec'
import { fetchPreconDeck, PRECON_BY_FILE } from '../lib/precons'
import { navigate } from '../lib/route'
import { autocomplete, ensureCards } from '../lib/scryfall'
import { swapsOf } from '../lib/data'
import { computeStats } from '../lib/stats'
import { actions, useData } from '../lib/store'
import { toast } from '../lib/toast'
import type { DeckEntry } from '../lib/types'
import { useDeckCards } from '../lib/useDeckCards'

const GROUPS: { label: string; test: (c: CardInfo) => boolean }[] = [
  { label: 'Creatures', test: isCreature },
  { label: 'Instants', test: (c) => /\bInstant\b/.test(c.typeLine) },
  { label: 'Sorceries', test: (c) => /\bSorcery\b/.test(c.typeLine) },
  { label: 'Enchantments', test: (c) => /\bEnchantment\b/.test(c.typeLine) },
  { label: 'Artifacts', test: isArtifact },
  { label: 'Planeswalkers', test: (c) => /\bPlaneswalker\b/.test(c.typeLine) },
  { label: 'Lands', test: isLand },
]

function groupDeck(entries: DeckEntry[], lookup: (n: string) => CardInfo | undefined) {
  const groups = new Map<string, DeckEntry[]>()
  for (const e of entries) {
    const card = lookup(e.name)
    const label = card ? (GROUPS.find((g) => g.test(card))?.label ?? 'Other') : 'No card data yet'
    groups.set(label, [...(groups.get(label) ?? []), e])
  }
  const order = [...GROUPS.map((g) => g.label), 'Other', 'No card data yet']
  return order
    .filter((l) => groups.has(l))
    .map((label) => ({ label, entries: groups.get(label)!.sort((a, b) => a.name.localeCompare(b.name, 'en')) }))
}

export function DeckPage() {
  const { swaps: allSwaps, settings, precon } = useData()
  const swaps = swapsOf(allSwaps, settings.defaultDeck)
  const deck = useDeckCards()
  const [sheet, setSheet] = useState<'import' | 'reset' | 'undo' | null>(null)
  const [card, setCard] = useState<string | null>(null)
  const size = deckSize(deck.decklist)
  const preconInfo = precon ? PRECON_BY_FILE.get(precon) : undefined
  const uniqueNames = useMemo(() => [...new Set([deck.commander, ...deck.decklist.map((e) => e.name)])], [deck.commander, deck.decklist])
  const loaded = uniqueNames.filter((n) => deck.lookup(n)).length
  const otherPrinting = uniqueNames.filter((n) => deck.lookup(n)?.requestedSet)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(serializeDecklist(deck.commander, deck.decklist, deck.commanderSet))
      toast('Decklist copied')
    } catch {
      toast("Couldn't copy")
    }
  }

  return (
    <div className="screen">
      <header className="screen-header">
        <IconButton icon={CaretLeftIcon} label="Back" onClick={() => navigate('/mehr')} />
      </header>

      <div className="deck-hero">
        <div className="deck-commander">
          <CardImage name={deck.commander} />
        </div>
        <div>
          <span className="eyebrow">Your deck</span>
          <h1>{deck.commander}</h1>
          <p className={size === 99 ? 'muted' : 'error-text'}>
            {size === 99 ? '99 cards + commander' : `${size} cards + commander (should be 99)`}
          </p>
          <p className="muted small">
            Card data: {loaded} of {uniqueNames.length} loaded
          </p>
        </div>
      </div>

      <div className="actions">
        <Button icon={ArrowsLeftRightIcon} onClick={() => navigate('/mehr/deck/swap')}>
          Swap round
        </Button>
        <Button variant="secondary" icon={ClipboardTextIcon} onClick={() => setSheet('import')}>
          Paste list
        </Button>
      </div>
      <Button variant="ghost" size="sm" icon={SwapIcon} onClick={() => navigate('/mehr/deck/wechseln')}>
        Play a different deck
      </Button>

      {(deck.missing.length > 0 || deck.error) && (
        <section className="panel notice">
          {deck.error && <p className="error-text">{deck.error}</p>}
          {deck.notFound.length > 0 && (
            <p>
              <WarningIcon weight="fill" aria-hidden="true" /> Not found on Scryfall:{' '}
              <strong>{deck.notFound.join(', ')}</strong>. Please check the name in the list.
            </p>
          )}
          <Button
            variant="secondary"
            size="sm"
            icon={deck.status === 'loading' ? ArrowClockwiseIcon : CloudArrowDownIcon}
            disabled={deck.status === 'loading'}
            onClick={() => void deck.load(true)}
          >
            {deck.status === 'loading' ? 'Loading…' : 'Load card data'}
          </Button>
        </section>
      )}

      {otherPrinting.length > 0 && (
        <section className="panel notice">
          <p className="small">
            <WarningIcon weight="fill" aria-hidden="true" /> For {otherPrinting.length} card{otherPrinting.length > 1 ? 's' : ''}, Scryfall doesn't have
            the requested printing, so a different version is shown ({otherPrinting.slice(0, 3).join(', ')}
            {otherPrinting.length > 3 ? ' …' : ''}). Tip: paste the list from Moxfield with set and number.
          </p>
        </section>
      )}

      {swaps.length > 0 && (
        <section className="list-group">
          <h2 className="list-title">Swap rounds</h2>
          <ul className="list">
            {[...swaps].reverse().map((s, i) => (
              <li key={s.id} className="swap-row">
                <div>
                  <strong>
                    Swap {swaps.length - i} · {formatDate(s.date)}
                  </strong>
                  <span className="swap-out">− {s.out.join(', ')}</span>
                  <span className="swap-in">+ {s.in.join(', ')}</span>
                  {s.note && <span className="muted small">"{s.note}"</span>}
                </div>
              </li>
            ))}
          </ul>
          <Button variant="ghost" size="sm" icon={ArrowCounterClockwiseIcon} onClick={() => setSheet('undo')}>
            Undo last swap
          </Button>
        </section>
      )}

      {groupDeck(deck.decklist, deck.lookup).map((group) => (
        <section key={group.label} className="list-group">
          <h2 className="list-title">
            {group.label} ({group.entries.reduce((s, e) => s + e.qty, 0)})
          </h2>
          <ul className="list">
            {group.entries.map((e) => {
              const info = deck.lookup(e.name)
              return (
                <li key={e.name}>
                  <button type="button" className="deck-row" onClick={() => setCard(e.name)}>
                    {info?.image ? <img src={info.image} alt="" loading="lazy" className="deck-thumb" /> : <span className="deck-thumb empty" />}
                    <span className="deck-name">
                      {e.name}
                      {info && (
                        <small className={info.requestedSet ? 'printing other' : 'printing'}>
                          {info.set.toUpperCase()}
                          {info.collectorNumber ? ` #${info.collectorNumber}` : ''}
                          {info.requestedSet ? ` instead of ${info.requestedSet.toUpperCase()}` : ''}
                        </small>
                      )}
                    </span>
                    {e.qty > 1 && <span className="deck-qty">{e.qty}×</span>}
                    {info && !isLand(info) && <span className="deck-cmc">{info.cmc}</span>}
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      ))}

      <div className="stack">
        <Button variant="ghost" size="sm" icon={CopyIcon} onClick={() => void copy()}>
          Copy decklist
        </Button>
        {preconInfo && (
          <Button variant="ghost" size="sm" icon={ArrowCounterClockwiseIcon} onClick={() => setSheet('reset')}>
            Reset to precon
          </Button>
        )}
      </div>
      <p className="muted small center">Card data and images: Scryfall. Magic: The Gathering © Wizards of the Coast.</p>

      <ImportSheet open={sheet === 'import'} onClose={() => setSheet(null)} commander={deck.commander} commanderSet={deck.commanderSet} />
      <ConfirmSheet
        open={sheet === 'reset'}
        title="Reset to precon?"
        text={`The decklist goes back to ${preconInfo?.name ?? 'the precon'} as it ships. Your swap history is kept.`}
        confirmLabel="Reset"
        onConfirm={() => {
          setSheet(null)
          if (precon) void resetToPrecon(precon)
        }}
        onClose={() => setSheet(null)}
      />
      <ConfirmSheet
        open={sheet === 'undo'}
        title="Undo last swap?"
        text="The swapped cards go back into the deck, and the swap is removed from the history."
        confirmLabel="Undo"
        onConfirm={() => {
          actions.undoLastSwap()
          setSheet(null)
          toast('Swap undone')
        }}
        onClose={() => setSheet(null)}
      />
      <BottomSheet open={card !== null} onClose={() => setCard(null)} title={card ?? undefined}>
        {card && <CardDetail name={card} />}
      </BottomSheet>
    </div>
  )
}

async function resetToPrecon(file: string) {
  try {
    const deck = await fetchPreconDeck(file)
    actions.setDecklist(deck.commander, deck.entries, deck.commanderSet)
    toast('Decklist reset')
    void ensureCards([{ name: deck.commander, set: deck.commanderSet }, ...deck.entries])
  } catch (err) {
    toast(err instanceof Error ? err.message : "Couldn't load the precon")
  }
}

function CardDetail({ name }: { name: string }) {
  const deck = useDeckCards({ autoLoad: false })
  const info = deck.lookup(name)
  if (!info) return <p className="muted">No Scryfall data for this card yet.</p>
  return (
    <div className="card-detail">
      {info.imageLarge && <img className="mtg-card-large" src={info.imageLarge} alt={info.name} />}
      <p className="muted small">
        {info.typeLine} · {info.setName || info.set.toUpperCase()}
        {info.collectorNumber ? ` #${info.collectorNumber}` : ''}
      </p>
      {info.oracleText && <p className="pre">{info.oracleText}</p>}
      {info.scryfallUri && (
        <a href={info.scryfallUri} target="_blank" rel="noreferrer" className="link">
          View on Scryfall
        </a>
      )}
    </div>
  )
}

function ImportSheet({
  open,
  onClose,
  commander,
  commanderSet,
}: {
  open: boolean
  onClose: () => void
  commander: string
  commanderSet: string | null
}) {
  const [text, setText] = useState('')
  const parsed = useMemo(() => parseDecklist(text), [text])
  const newCommander = parsed.commander ?? commander
  const newCommanderSet = parsed.commander ? parsed.commanderSet : commanderSet
  const entries = parsed.entries.filter((e) => cardKey(e.name) !== cardKey(newCommander))
  const size = deckSize(entries)

  const apply = () => {
    actions.setDecklist(newCommander, entries, newCommanderSet)
    void ensureCards([{ name: newCommander, set: newCommanderSet }, ...entries])
    setText('')
    onClose()
    toast(`Decklist applied (${size} cards)`)
  }

  return (
    <BottomSheet open={open} onClose={onClose} title="Paste decklist">
      <p className="muted small">
        Export the list from Moxfield, Archidekt or MTG Arena and paste it here. One card per line, e.g. "1 Sol
        Ring".
      </p>
      <textarea rows={8} value={text} onChange={(e) => setText(e.target.value)} placeholder={'Commander\n1 Your Commander\n\nDeck\n1 Sol Ring\n1 Command Tower\n…'} />
      {text.trim() && (
        <p className={size === 99 ? 'muted small' : 'error-text small'}>
          {size} cards recognized{parsed.commander ? `, Commander: ${parsed.commander}` : ''}.
          {size !== 99 && ' A Commander deck has 99 cards plus the commander.'}
          {parsed.errors.length > 0 && ` Not understood: ${parsed.errors.slice(0, 3).join(' | ')}`}
        </p>
      )}
      <Button block disabled={size === 0} onClick={apply}>
        Apply
      </Button>
    </BottomSheet>
  )
}

// --- Swap round -------------------------------------------------------------------

export function SwapFlow() {
  const { games, settings, swaps: allSwaps, decklist, commander } = useData()
  const swaps = swapsOf(allSwaps, settings.defaultDeck)
  const [step, setStep] = useState<'out' | 'in'>('out')
  const [out, setOut] = useState<string[]>([])
  const [into, setInto] = useState<string[]>([])
  const [note, setNote] = useState('')
  const [query, setQuery] = useState('')

  const stats = computeStats(games, settings.defaultDeck, { swaps: allSwaps, decklist })
  const maxCards = stats.upgrade.cards
  const deadCount = new Map(stats.deadCards.map((t) => [cardKey(t.name), t.count]))
  const names = deckCardNames(decklist)
  const basics = decklist.filter((e) => isBasicLand(e.name)).map((e) => e.name)
  const all = [...names, ...basics]
  const candidates = all.filter((n) => (deadCount.get(cardKey(n)) ?? 0) >= 2).sort((a, b) => (deadCount.get(cardKey(b)) ?? 0) - (deadCount.get(cardKey(a)) ?? 0))
  const filtered = all.filter((n) => !candidates.includes(n) && n.toLowerCase().includes(query.trim().toLowerCase()))

  const toggleOut = (name: string) => {
    if (!out.includes(name) && out.length >= maxCards) {
      toast(`At most ${maxCards} card${maxCards > 1 ? 's' : ''} this round.`)
      return
    }
    haptic()
    setOut((o) => (o.includes(name) ? o.filter((x) => x !== name) : [...o, name]))
  }

  const save = () => {
    actions.addSwap(out, into, note.trim())
    void ensureCards(into)
    toast(`Swap saved. Now test it for ${UPGRADE_EVERY_GAMES} games.`)
    navigate('/mehr/deck', { replace: true })
  }

  if (step === 'out') {
    return (
      <div className="screen flow">
        <header className="flow-header">
          <IconButton icon={XIcon} label="Cancel" onClick={() => navigate('/mehr/deck')} />
          <span className="flow-title">Swap round {swaps.length + 1}</span>
        </header>
        <div className="question">
          <h1>What goes out?</h1>
          <p className="muted">
            At most {maxCards} card{maxCards > 1 ? 's' : ''} this round, so you can see the effect. Never cut lands, ramp or the
            cards that make {shortName(commander)} work.
          </p>
        </div>

        {candidates.length > 0 && (
          <section className="list-group">
            <h2 className="list-title">Often dead in hand</h2>
            <ul className="list">
              {candidates.map((n) => (
                <SelectRow key={n} name={n} selected={out.includes(n)} badge={`${deadCount.get(cardKey(n))}× dead`} onToggle={() => toggleOut(n)} />
              ))}
            </ul>
          </section>
        )}

        <label className="search">
          <MagnifyingGlassIcon weight="bold" aria-hidden="true" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search cards in deck" />
        </label>
        <ul className="list">
          {filtered.map((n) => (
            <SelectRow key={n} name={n} selected={out.includes(n)} onToggle={() => toggleOut(n)} />
          ))}
        </ul>

        <footer className="flow-footer">
          <Button block disabled={out.length === 0} onClick={() => setStep('in')}>
            Continue{out.length ? ` (${out.length}/${maxCards} out)` : ''}
          </Button>
        </footer>
      </div>
    )
  }

  return (
    <div className="screen flow">
      <header className="flow-header">
        <IconButton icon={CaretLeftIcon} label="Back" onClick={() => setStep('out')} />
        <span className="flow-title">Swap round {swaps.length + 1}</span>
      </header>
      <div className="question">
        <h1>What goes in?</h1>
        <p className="muted">Close the real gap first: interaction against artifacts and enchantments, protection against wipes.</p>
      </div>

      <p className="swap-out">− {out.join(', ')}</p>
      <CardSearch selected={into} max={out.length} onAdd={(n) => setInto((i) => [...i, n])} />
      <Suggestions
        commander={commander}
        inDeck={[commander, ...decklist.map((e) => e.name)]}
        gameChangers={settings.defaultBracket >= 3}
        selected={into}
        full={into.length >= out.length}
        onToggle={(n) => setInto((i) => (i.includes(n) ? i.filter((x) => x !== n) : [...i, n]))}
      />
      {into.length > 0 && (
        <ul className="chip-list">
          {into.map((n) => (
            <li key={n} className="chip selected">
              {n}
              <button type="button" aria-label={`Remove ${n}`} onClick={() => setInto((i) => i.filter((x) => x !== n))}>
                <XIcon weight="bold" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <Field label="Why? (optional)">
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. more protection against wipes" />
      </Field>

      <footer className="flow-footer">
        <Button block disabled={into.length !== out.length} onClick={save}>
          {into.length === out.length ? 'Save swap' : `${into.length} of ${out.length} chosen`}
        </Button>
      </footer>
    </div>
  )
}

function SelectRow({ name, selected, badge, onToggle }: { name: string; selected: boolean; badge?: string; onToggle: () => void }) {
  return (
    <li>
      <button type="button" className={`select-row ${selected ? 'selected' : ''}`} role="checkbox" aria-checked={selected} onClick={onToggle}>
        <span className="select-box" aria-hidden="true">
          {selected && <CheckIcon weight="bold" />}
        </span>
        <span className="deck-name">{name}</span>
        {badge && <span className="tag inline">{badge}</span>}
      </button>
    </li>
  )
}

type SuggestionState = { status: 'loading' } | { status: 'error'; error: string } | { status: 'ready'; cards: Suggestion[] }

/** Popular cards for your commander on EDHREC, as a starting point for the "in" pick. */
function Suggestions({
  commander,
  inDeck,
  gameChangers,
  selected,
  full,
  onToggle,
}: {
  commander: string
  inDeck: string[]
  gameChangers: boolean
  selected: string[]
  full: boolean
  onToggle: (name: string) => void
}) {
  const [state, setState] = useState<SuggestionState>({ status: 'loading' })
  const [shown, setShown] = useState(10)
  const deckKey = inDeck.join('|')

  useEffect(() => {
    let active = true
    setState({ status: 'loading' })
    fetchCommanderPage(commander).then(
      (page) => {
        if (!active) return
        try {
          setState({ status: 'ready', cards: parseSuggestions(page, { inDeck: deckKey.split('|'), gameChangers }) })
        } catch (err) {
          setState({ status: 'error', error: err instanceof Error ? err.message : String(err) })
        }
      },
      (err: unknown) => active && setState({ status: 'error', error: err instanceof Error ? err.message : String(err) }),
    )
    return () => {
      active = false
    }
  }, [commander, deckKey, gameChangers])

  return (
    <section className="list-group">
      <h2 className="list-title">Popular with {shortName(commander)}</h2>
      {state.status === 'loading' && <p className="muted small">Loading suggestions from EDHREC…</p>}
      {state.status === 'error' && <p className="muted small">{state.error}</p>}
      {state.status === 'ready' && (
        <>
          <ul className="list">
            {state.cards.slice(0, shown).map((c) => (
              <SelectRow
                key={c.name}
                name={c.name}
                selected={selected.includes(c.name)}
                badge={`${Math.round(c.inclusion * 100)}%`}
                onToggle={() => {
                  if (full && !selected.includes(c.name)) {
                    toast('All slots filled. Remove a card first.')
                    return
                  }
                  haptic()
                  onToggle(c.name)
                }}
              />
            ))}
          </ul>
          {shown < state.cards.length && (
            <Button variant="ghost" size="sm" onClick={() => setShown((n) => n + 10)}>
              Show more
            </Button>
          )}
          <p className="list-footnote">
            Share of {shortName(commander)} decks on EDHREC that play the card.
            {gameChangers ? '' : ' Game Changers are left out, so your deck stays in its bracket.'} Check that a suggestion fits your
            plan before you swap.
          </p>
        </>
      )}
    </section>
  )
}

/** Card search with Scryfall suggestions (online); offline the typed name works. */
function CardSearch({ selected, max, onAdd }: { selected: string[]; max: number; onAdd: (name: string) => void }) {
  const [text, setText] = useState('')
  const [results, setResults] = useState<string[]>([])
  const full = selected.length >= max

  useEffect(() => {
    const q = text.trim()
    if (q.length < 2 || !navigator.onLine) {
      setResults([])
      return
    }
    let stale = false
    const timer = setTimeout(() => {
      autocomplete(q)
        .then((r) => !stale && setResults(r.slice(0, 8)))
        .catch(() => !stale && setResults([]))
    }, 250)
    return () => {
      stale = true
      clearTimeout(timer)
    }
  }, [text])

  const add = (name: string) => {
    if (full || !name.trim() || selected.some((s) => cardKey(s) === cardKey(name))) return
    haptic()
    onAdd(name.trim())
    setText('')
    setResults([])
  }

  return (
    <div className="card-search">
      <label className="search">
        <MagnifyingGlassIcon weight="bold" aria-hidden="true" />
        <input
          value={text}
          disabled={full}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add(text)}
          placeholder={full ? 'All slots filled' : 'Search new card (Scryfall)'}
          enterKeyHint="done"
        />
      </label>
      {results.length > 0 && (
        <ul className="list">
          {results.map((r) => (
            <li key={r}>
              <button type="button" className="select-row" onClick={() => add(r)}>
                <span className="deck-name">{r}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {text.trim().length >= 2 && results.length === 0 && (
        <Button variant="secondary" size="sm" onClick={() => add(text)}>
          Use "{text.trim()}"
        </Button>
      )}
    </div>
  )
}

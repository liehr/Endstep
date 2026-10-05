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
  WarningIcon,
  XIcon,
} from '@phosphor-icons/react'
import { useEffect, useMemo, useState } from 'react'
import { CardImage } from '../components/CardImage'
import { BottomSheet, Button, ConfirmSheet, Field, IconButton } from '../components/ui'
import { cardKey, isArtifact, isCreature, isLand, type CardInfo } from '../lib/cards'
import { formatDate } from '../lib/dates'
import {
  DEFAULT_COMMANDER,
  DEFAULT_DECKLIST,
  DEFAULT_SET,
  deckCardNames,
  deckSize,
  parseDecklist,
  serializeDecklist,
} from '../lib/decklist'
import { haptic } from '../lib/haptics'
import { navigate } from '../lib/route'
import { autocomplete, ensureCards } from '../lib/scryfall'
import { computeStats } from '../lib/stats'
import { actions, useData } from '../lib/store'
import { toast } from '../lib/toast'
import type { DeckEntry } from '../lib/types'
import { useDeckCards } from '../lib/useDeckCards'

const GROUPS: { label: string; test: (c: CardInfo) => boolean }[] = [
  { label: 'Kreaturen', test: isCreature },
  { label: 'Spontanzauber', test: (c) => /\bInstant\b/.test(c.typeLine) },
  { label: 'Hexereien', test: (c) => /\bSorcery\b/.test(c.typeLine) },
  { label: 'Verzauberungen', test: (c) => /\bEnchantment\b/.test(c.typeLine) },
  { label: 'Artefakte', test: isArtifact },
  { label: 'Planeswalker', test: (c) => /\bPlaneswalker\b/.test(c.typeLine) },
  { label: 'Länder', test: isLand },
]

function groupDeck(entries: DeckEntry[], lookup: (n: string) => CardInfo | undefined) {
  const groups = new Map<string, DeckEntry[]>()
  for (const e of entries) {
    const card = lookup(e.name)
    const label = card ? (GROUPS.find((g) => g.test(card))?.label ?? 'Sonstiges') : 'Noch ohne Kartendaten'
    groups.set(label, [...(groups.get(label) ?? []), e])
  }
  const order = [...GROUPS.map((g) => g.label), 'Sonstiges', 'Noch ohne Kartendaten']
  return order
    .filter((l) => groups.has(l))
    .map((label) => ({ label, entries: groups.get(label)!.sort((a, b) => a.name.localeCompare(b.name, 'en')) }))
}

export function DeckPage() {
  const { swaps } = useData()
  const deck = useDeckCards()
  const [sheet, setSheet] = useState<'import' | 'reset' | 'undo' | null>(null)
  const [card, setCard] = useState<string | null>(null)
  const size = deckSize(deck.decklist)
  const uniqueNames = useMemo(() => [...new Set([deck.commander, ...deck.decklist.map((e) => e.name)])], [deck.commander, deck.decklist])
  const loaded = uniqueNames.filter((n) => deck.lookup(n)).length
  const otherPrinting = uniqueNames.filter((n) => deck.lookup(n)?.requestedSet)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(serializeDecklist(deck.commander, deck.decklist, deck.commanderSet))
      toast('Deckliste kopiert')
    } catch {
      toast('Kopieren nicht möglich')
    }
  }

  return (
    <div className="screen">
      <header className="screen-header">
        <IconButton icon={CaretLeftIcon} label="Zurück" onClick={() => navigate('/mehr')} />
      </header>

      <div className="deck-hero">
        <div className="deck-commander">
          <CardImage name={deck.commander} />
        </div>
        <div>
          <span className="eyebrow">Dein Deck</span>
          <h1>{deck.commander}</h1>
          <p className={size === 99 ? 'muted' : 'error-text'}>
            {size === 99 ? '99 Karten + Commander' : `${size} Karten + Commander (sollten 99 sein)`}
          </p>
          <p className="muted small">
            Kartendaten: {loaded} von {uniqueNames.length} geladen
          </p>
        </div>
      </div>

      <div className="actions">
        <Button icon={ArrowsLeftRightIcon} onClick={() => navigate('/mehr/deck/swap')}>
          Swap-Runde
        </Button>
        <Button variant="secondary" icon={ClipboardTextIcon} onClick={() => setSheet('import')}>
          Liste einfügen
        </Button>
      </div>

      {(deck.missing.length > 0 || deck.error) && (
        <section className="panel notice">
          {deck.error && <p className="error-text">{deck.error}</p>}
          {deck.notFound.length > 0 && (
            <p>
              <WarningIcon weight="fill" aria-hidden="true" /> Bei Scryfall nicht gefunden:{' '}
              <strong>{deck.notFound.join(', ')}</strong>. Bitte den Namen in der Liste prüfen.
            </p>
          )}
          <Button
            variant="secondary"
            size="sm"
            icon={deck.status === 'loading' ? ArrowClockwiseIcon : CloudArrowDownIcon}
            disabled={deck.status === 'loading'}
            onClick={() => void deck.load(true)}
          >
            {deck.status === 'loading' ? 'Lädt…' : 'Kartendaten laden'}
          </Button>
        </section>
      )}

      {otherPrinting.length > 0 && (
        <section className="panel notice">
          <p className="small">
            <WarningIcon weight="fill" aria-hidden="true" /> Für {otherPrinting.length} Karte{otherPrinting.length > 1 ? 'n' : ''} gibt es die
            gewünschte Druckversion bei Scryfall nicht, es wird eine andere Version gezeigt ({otherPrinting.slice(0, 3).join(', ')}
            {otherPrinting.length > 3 ? ' …' : ''}). Tipp: Liste mit Set und Nummer aus Moxfield einfügen.
          </p>
        </section>
      )}

      {swaps.length > 0 && (
        <section className="list-group">
          <h2 className="list-title">Swap-Runden</h2>
          <ul className="list">
            {[...swaps].reverse().map((s, i) => (
              <li key={s.id} className="swap-row">
                <div>
                  <strong>
                    Swap {swaps.length - i} · {formatDate(s.date)}
                  </strong>
                  <span className="swap-out">− {s.out.join(', ')}</span>
                  <span className="swap-in">+ {s.in.join(', ')}</span>
                  {s.note && <span className="muted small">„{s.note}“</span>}
                </div>
              </li>
            ))}
          </ul>
          <Button variant="ghost" size="sm" icon={ArrowCounterClockwiseIcon} onClick={() => setSheet('undo')}>
            Letzten Swap rückgängig
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
                          {info.requestedSet ? ` statt ${info.requestedSet.toUpperCase()}` : ''}
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
          Deckliste kopieren
        </Button>
        <Button variant="ghost" size="sm" icon={ArrowCounterClockwiseIcon} onClick={() => setSheet('reset')}>
          Auf Precon zurücksetzen
        </Button>
      </div>
      <p className="muted small center">Kartendaten und -bilder: Scryfall. Magic: The Gathering © Wizards of the Coast.</p>

      <ImportSheet open={sheet === 'import'} onClose={() => setSheet(null)} commander={deck.commander} commanderSet={deck.commanderSet} />
      <ConfirmSheet
        open={sheet === 'reset'}
        title="Auf Precon zurücksetzen?"
        text="Die Deckliste wird wieder Tramplesaurus Rex im Auslieferungszustand. Der Swap-Verlauf bleibt erhalten."
        confirmLabel="Zurücksetzen"
        onConfirm={() => {
          actions.setDecklist(DEFAULT_COMMANDER, DEFAULT_DECKLIST.map((e) => ({ ...e })), DEFAULT_SET)
          setSheet(null)
          toast('Deckliste zurückgesetzt')
        }}
        onClose={() => setSheet(null)}
      />
      <ConfirmSheet
        open={sheet === 'undo'}
        title="Letzten Swap rückgängig machen?"
        text="Die getauschten Karten kommen zurück ins Deck, der Swap wird aus dem Verlauf entfernt."
        confirmLabel="Rückgängig"
        onConfirm={() => {
          actions.undoLastSwap()
          setSheet(null)
          toast('Swap rückgängig gemacht')
        }}
        onClose={() => setSheet(null)}
      />
      <BottomSheet open={card !== null} onClose={() => setCard(null)} title={card ?? undefined}>
        {card && <CardDetail name={card} />}
      </BottomSheet>
    </div>
  )
}

function CardDetail({ name }: { name: string }) {
  const deck = useDeckCards({ autoLoad: false })
  const info = deck.lookup(name)
  if (!info) return <p className="muted">Für diese Karte gibt es noch keine Daten von Scryfall.</p>
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
          Auf Scryfall ansehen
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
    toast(`Deckliste übernommen (${size} Karten)`)
  }

  return (
    <BottomSheet open={open} onClose={onClose} title="Deckliste einfügen">
      <p className="muted small">
        Liste aus Moxfield, Archidekt oder MTG Arena exportieren und hier einfügen. Eine Karte pro Zeile, z. B. „1 Sol
        Ring“.
      </p>
      <textarea rows={8} value={text} onChange={(e) => setText(e.target.value)} placeholder={'Commander\n1 Ghalta, Primal Hunger\n\nDeck\n1 Llanowar Elves\n32 Forest\n…'} />
      {text.trim() && (
        <p className={size === 99 ? 'muted small' : 'error-text small'}>
          {size} Karten erkannt{parsed.commander ? `, Commander: ${parsed.commander}` : ''}.
          {size !== 99 && ' Ein Commander-Deck hat 99 Karten plus Commander.'}
          {parsed.errors.length > 0 && ` Nicht verstanden: ${parsed.errors.slice(0, 3).join(' | ')}`}
        </p>
      )}
      <Button block disabled={size === 0} onClick={apply}>
        Übernehmen
      </Button>
    </BottomSheet>
  )
}

// --- Swap-Runde -------------------------------------------------------------------

export function SwapFlow() {
  const { games, settings, swaps, decklist } = useData()
  const [step, setStep] = useState<'out' | 'in'>('out')
  const [out, setOut] = useState<string[]>([])
  const [into, setInto] = useState<string[]>([])
  const [note, setNote] = useState('')
  const [query, setQuery] = useState('')

  const stats = computeStats(games, settings.defaultDeck, { swaps, decklist })
  const deadCount = new Map(stats.deadCards.map((t) => [cardKey(t.name), t.count]))
  const names = deckCardNames(decklist)
  const hasForest = decklist.some((e) => /^forest$/i.test(e.name))
  const all = hasForest ? [...names, 'Forest'] : names
  const candidates = all.filter((n) => (deadCount.get(cardKey(n)) ?? 0) >= 2).sort((a, b) => (deadCount.get(cardKey(b)) ?? 0) - (deadCount.get(cardKey(a)) ?? 0))
  const filtered = all.filter((n) => !candidates.includes(n) && n.toLowerCase().includes(query.trim().toLowerCase()))

  const toggleOut = (name: string) => {
    haptic()
    setOut((o) => (o.includes(name) ? o.filter((x) => x !== name) : [...o, name]))
  }

  const save = () => {
    actions.addSwap(out, into, note.trim())
    void ensureCards(into)
    toast(`Swap gespeichert. Jetzt ${5} Spiele testen.`)
    navigate('/mehr/deck', { replace: true })
  }

  if (step === 'out') {
    return (
      <div className="screen flow">
        <header className="flow-header">
          <IconButton icon={XIcon} label="Abbrechen" onClick={() => navigate('/mehr/deck')} />
          <span className="flow-title">Swap-Runde {swaps.length + 1}</span>
        </header>
        <div className="question">
          <h1>Was kommt raus?</h1>
          <p className="muted">3–5 Karten pro Runde. Nie Länder, Ramp oder direkte Ghalta-Unterstützung streichen.</p>
        </div>

        {candidates.length > 0 && (
          <section className="list-group">
            <h2 className="list-title">Oft tot auf der Hand</h2>
            <ul className="list">
              {candidates.map((n) => (
                <SelectRow key={n} name={n} selected={out.includes(n)} badge={`${deadCount.get(cardKey(n))}× tot`} onToggle={() => toggleOut(n)} />
              ))}
            </ul>
          </section>
        )}

        <label className="search">
          <MagnifyingGlassIcon weight="bold" aria-hidden="true" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Karte im Deck suchen" />
        </label>
        <ul className="list">
          {filtered.map((n) => (
            <SelectRow key={n} name={n} selected={out.includes(n)} onToggle={() => toggleOut(n)} />
          ))}
        </ul>

        <footer className="flow-footer">
          <Button block disabled={out.length === 0} onClick={() => setStep('in')}>
            Weiter{out.length ? ` (${out.length} raus)` : ''}
          </Button>
        </footer>
      </div>
    )
  }

  return (
    <div className="screen flow">
      <header className="flow-header">
        <IconButton icon={CaretLeftIcon} label="Zurück" onClick={() => setStep('out')} />
        <span className="flow-title">Swap-Runde {swaps.length + 1}</span>
      </header>
      <div className="question">
        <h1>Was kommt rein?</h1>
        <p className="muted">Zuerst die echte Lücke schließen: Interaktion gegen Artefakte und Verzauberungen, Schutz gegen Wipes.</p>
      </div>

      <p className="swap-out">− {out.join(', ')}</p>
      <CardSearch selected={into} max={out.length} onAdd={(n) => setInto((i) => [...i, n])} />
      {into.length > 0 && (
        <ul className="chip-list">
          {into.map((n) => (
            <li key={n} className="chip selected">
              {n}
              <button type="button" aria-label={`${n} entfernen`} onClick={() => setInto((i) => i.filter((x) => x !== n))}>
                <XIcon weight="bold" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <Field label="Warum? (optional)">
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="z. B. mehr Schutz gegen Wipes" />
      </Field>

      <footer className="flow-footer">
        <Button block disabled={into.length !== out.length} onClick={save}>
          {into.length === out.length ? 'Swap speichern' : `${into.length} von ${out.length} gewählt`}
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

/** Kartensuche mit Scryfall-Vorschlägen (online); offline geht der eingetippte Name. */
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
          placeholder={full ? 'Alle Plätze belegt' : 'Neue Karte suchen (Scryfall)'}
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
          „{text.trim()}“ übernehmen
        </Button>
      )}
    </div>
  )
}

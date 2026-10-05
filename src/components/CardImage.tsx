import { CheckIcon, MagnifyingGlassPlusIcon, XIcon } from '@phosphor-icons/react'
import { useState } from 'react'
import { getCard, useCardState } from '../lib/scryfall'
import { BottomSheet } from './ui'

/** Card image from Scryfall; without data a placeholder with the name. Tap to enlarge. */
export function CardImage({ name, caption }: { name: string; caption?: string }) {
  useCardState()
  const card = getCard(name)
  const [open, setOpen] = useState(false)
  const [failed, setFailed] = useState(false)

  return (
    <figure className="mtg-card">
      <button type="button" className="mtg-card-btn" onClick={() => card?.imageLarge && setOpen(true)} aria-label={name}>
        {card?.image && !failed ? (
          <img src={card.image} alt={name} loading="lazy" decoding="async" onError={() => setFailed(true)} />
        ) : (
          <span className="mtg-card-fallback">{name}</span>
        )}
      </button>
      {caption && <figcaption>{caption}</figcaption>}
      {card?.imageLarge && (
        <BottomSheet open={open} onClose={() => setOpen(false)} title={card.name}>
          <img className="mtg-card-large" src={card.imageLarge} alt={card.name} />
          {card.oracleText && <p className="muted pre">{card.oracleText}</p>}
        </BottomSheet>
      )}
    </figure>
  )
}

export function CardGrid({ cards, label }: { cards: { name: string; caption?: string }[]; label?: string }) {
  return (
    <section className="card-grid-wrap" aria-label={label}>
      {label && <span className="eyebrow">{label}</span>}
      <div className={`card-grid ${cards.length === 1 ? 'single' : ''}`}>
        {cards.map((c, i) => (
          <CardImage key={`${c.name}-${i}`} name={c.name} caption={c.caption} />
        ))}
      </div>
    </section>
  )
}

export type PickState = '' | 'selected' | 'right' | 'wrong' | 'missed'

/** A card you can tap to select (tap-on-board questions); the magnifier enlarges it. */
function PickableCard({ name, caption, state, disabled, onToggle }: { name: string; caption?: string; state: PickState; disabled: boolean; onToggle: () => void }) {
  useCardState()
  const card = getCard(name)
  const [open, setOpen] = useState(false)
  const [failed, setFailed] = useState(false)
  const picked = state === 'selected' || state === 'right' || state === 'wrong'

  return (
    <figure className={`mtg-card pickable ${state}`}>
      <div className="pick-wrap">
        <button type="button" className="mtg-card-btn" aria-pressed={picked} aria-label={caption ? `${name}, ${caption}` : name} disabled={disabled} onClick={onToggle}>
          {card?.image && !failed ? (
            <img src={card.image} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)} />
          ) : (
            <span className="mtg-card-fallback">{name}</span>
          )}
          {state && state !== 'missed' && (
            <span className="pick-badge" aria-hidden="true">
              {state === 'wrong' ? <XIcon weight="bold" /> : <CheckIcon weight="bold" />}
            </span>
          )}
        </button>
        {card?.imageLarge && (
          <button type="button" className="pick-zoom" aria-label={`Enlarge ${name}`} onClick={() => setOpen(true)}>
            <MagnifyingGlassPlusIcon weight="bold" />
          </button>
        )}
      </div>
      {caption && <figcaption>{caption}</figcaption>}
      {card?.imageLarge && (
        <BottomSheet open={open} onClose={() => setOpen(false)} title={card.name}>
          <img className="mtg-card-large" src={card.imageLarge} alt={card.name} />
          {card.oracleText && <p className="muted pre">{card.oracleText}</p>}
        </BottomSheet>
      )}
    </figure>
  )
}

export function PickCardGrid({
  cards,
  states,
  disabled,
  onToggle,
}: {
  cards: { name: string; caption?: string }[]
  states: PickState[]
  disabled: boolean
  onToggle: (index: number) => void
}) {
  return (
    <div className="card-grid pick-grid" role="group" aria-label="Cards to tap">
      {cards.map((c, i) => (
        <PickableCard key={`${c.name}-${i}`} name={c.name} caption={c.caption} state={states[i] ?? ''} disabled={disabled} onToggle={() => onToggle(i)} />
      ))}
    </div>
  )
}

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

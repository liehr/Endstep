import type { ReactNode } from 'react'
import { GAP, type CardFace, type FieldId } from '../lib/quiz/cardQuiz'

const isManaString = (s: string) => /^(\{[^}]+\})+$/.test(s)

/** Mana-Symbole wie {2}{G}{G} als runde Plättchen. */
export function Mana({ cost }: { cost: string }) {
  const symbols = [...cost.matchAll(/\{([^}]+)\}/g)].map((m) => m[1])
  return (
    <span className="mana" aria-label={cost}>
      {symbols.map((s, i) => (
        <span key={i} className={`pip pip-${/^\d+$|^X$/.test(s) ? 'n' : s === 'T' ? 't' : s.replace('/', '').toLowerCase()}`} aria-hidden="true">
          {s === 'T' ? '↷' : s}
        </span>
      ))}
    </span>
  )
}

/** Text oder Mana-String passend darstellen (für Antwortoptionen und Kacheln). */
export function AnswerLabel({ value }: { value: string }) {
  return isManaString(value) ? <Mana cost={value} /> : <>{value}</>
}

/** Regeltext mit Mana-Symbolen, Zeilenumbrüchen, Lücke und versteckten Namen (~). */
function RulesText({ text, gap }: { text: string; gap: ReactNode }) {
  const parts = text.split(/(\{[^}]+\}|~|⦁|\n)/)
  return (
    <>
      {parts.map((p, i) => {
        if (p === '\n') return <br key={i} />
        if (p === GAP) return <span key={i}>{gap}</span>
        if (p === '~') return <span key={i} className="name-mask" aria-label="Kartenname">▢▢▢</span>
        if (/^\{[^}]+\}$/.test(p)) return <Mana key={i} cost={p} />
        return <span key={i}>{p}</span>
      })}
    </>
  )
}

/** corrected = falsch beantwortet, die Lücke zeigt jetzt die richtige Lösung. */
export type SlotState = 'empty' | 'filled' | 'right' | 'corrected'

export interface Slot {
  /** Angezeigter Inhalt (ausgefüllte Kachel oder aufgedeckte Antwort); leer = „?“. */
  value: string | null
  state: SlotState
  /** Tippen auf eine gefüllte Lücke gibt die Kachel zurück. */
  onClick?: () => void
  active?: boolean
}

function SlotView({ slot, wide }: { slot: Slot; wide?: boolean }) {
  return (
    <button
      type="button"
      className={`slot ${slot.state} ${slot.active ? 'active' : ''} ${wide ? 'wide' : ''}`}
      onClick={slot.onClick}
      disabled={!slot.onClick}
    >
      {slot.value ? <AnswerLabel value={slot.value} /> : '?'}
    </button>
  )
}

/** Selbst gezeichnete Magic-Karte, bei der einzelne Felder als Lücke erscheinen. */
export function CardFrame({ face, slots }: { face: CardFace; slots: Partial<Record<FieldId, Slot>> }) {
  const field = (id: FieldId, content: ReactNode, wide = false) => {
    const slot = slots[id]
    return slot ? <SlotView slot={slot} wide={wide} /> : content
  }

  return (
    <div className={`card-frame frame-${face.frame}`} role="img" aria-label="Karte mit Lücken">
      <div className="cf-inner">
        <div className="cf-title">
          <span className="cf-name">{field('name', face.name, true)}</span>
          <span className="cf-cost">{field('cost', face.manaCost ? <Mana cost={face.manaCost} /> : null)}</span>
        </div>
        <div className="cf-art">{face.art ? <img src={face.art} alt="" loading="lazy" /> : <span className="cf-art-empty" />}</div>
        <div className="cf-type">{field('type', face.typeLine, true)}</div>
        <div className="cf-text">
          <RulesText text={face.text} gap={slots.gap ? <SlotView slot={slots.gap} /> : null} />
        </div>
        {(face.pt || slots.pt) && <div className="cf-pt">{field('pt', face.pt)}</div>}
      </div>
    </div>
  )
}

import { ATTACK_PRIORITIES, RULES } from '../lib/content'

export function AttackList() {
  return (
    <ol className="numbered">
      {ATTACK_PRIORITIES.map((p, i) => (
        <li key={p}>
          <span className="num" aria-hidden="true">
            {i + 1}
          </span>
          <span>{p}</span>
        </li>
      ))}
    </ol>
  )
}

export function RulesList() {
  return (
    <dl className="rules">
      {RULES.map((r) => (
        <div key={r.title}>
          <dt>{r.title}</dt>
          <dd>{r.text}</dd>
        </div>
      ))}
    </dl>
  )
}

import { describe, expect, it } from 'vitest'
import { addDays, INTERVALS, recordAnswer, selectQuestions, topicOf } from './memory'

const today = '2026-10-05'
const q = (key: string, group?: string) => ({ key, group })

describe('recordAnswer', () => {
  it('moves up one box per right answer and pushes the next review out', () => {
    let m = recordAnswer({}, 'rule-a', true, today)
    expect(m['rule-a']).toMatchObject({ box: 1, due: addDays(today, INTERVALS[1]), seen: 1, wrong: 0 })
    m = recordAnswer(m, 'rule-a', true, today)
    expect(m['rule-a']).toMatchObject({ box: 2, due: addDays(today, INTERVALS[2]), seen: 2 })
  })

  it('a wrong answer resets to box 0 and is due right away', () => {
    let m = recordAnswer({}, 'rule-a', true, today)
    m = recordAnswer(m, 'rule-a', false, today)
    expect(m['rule-a']).toMatchObject({ box: 0, due: today, seen: 2, wrong: 1 })
  })

  it('never goes past the last box', () => {
    let m = {}
    for (let i = 0; i < 10; i++) m = recordAnswer(m, 'k', true, today)
    expect(m).toMatchObject({ k: { box: INTERVALS.length - 1 } })
  })
})

describe('addDays', () => {
  it('crosses month and year boundaries', () => {
    expect(addDays('2026-10-30', 3)).toBe('2026-11-02')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
  })
})

describe('selectQuestions', () => {
  it('takes due reviews first, then new questions, then seen ones', () => {
    const memory = {
      seen: { box: 2, due: '2026-10-09', seen: 2, wrong: 0, last: '2026-10-02' },
      due: { box: 0, due: today, seen: 1, wrong: 1, last: today },
    }
    const picked = selectQuestions([q('seen'), q('new1'), q('due'), q('new2')], memory, today, 3).map((x) => x.key)
    expect(picked).toEqual(['new1', 'due', 'new2'])
  })

  it('spreads questions across topics and groups when possible', () => {
    const candidates = [q('a:1', 'x'), q('a:2', 'y'), q('a:3', 'z'), q('b:1', 'x'), q('c:1', 'w')]
    const picked = selectQuestions(candidates, {}, today, 3)
    expect(picked.map((x) => topicOf(x.key))).toEqual(['a', 'a', 'c'])
    expect(new Set(picked.map((x) => x.group)).size).toBe(3)
  })

  it('fills up from one topic if nothing else is left', () => {
    const picked = selectQuestions([q('a:1'), q('a:2'), q('a:3')], {}, today, 3)
    expect(picked).toHaveLength(3)
  })

  it('drops duplicate keys', () => {
    expect(selectQuestions([q('a:1'), q('a:1'), q('b:1')], {}, today, 5)).toHaveLength(2)
  })
})

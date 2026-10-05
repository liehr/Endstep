// Builds the bundled precon index (src/lib/precons.json) from MTGJSON:
// every Commander precon with its commander(s), so the deck picker can search
// by deck name, set or commander, also offline. Run: node scripts/precons.mjs

import { writeFile } from 'node:fs/promises'

const API = 'https://mtgjson.com/api/v5'
const OUT = new URL('../src/lib/precons.json', import.meta.url)

async function json(url) {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, { headers: { Accept: 'application/json' } })
    if (res.ok) return res.json()
    if (attempt >= 3) throw new Error(`${url}: ${res.status}`)
    await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt))
  }
}

/** Art-series style names ("Okaun // Okaun") become one name. */
const sameFaces = (name) => {
  const [front, back] = name.split(' // ')
  return back === front ? front : name
}

const list = (await json(`${API}/DeckList.json`)).data.filter((d) => d.type === 'Commander Deck')
const out = []
for (let i = 0; i < list.length; i += 8) {
  const batch = await Promise.all(
    list.slice(i, i + 8).map(async (d) => {
      const deck = (await json(`${API}/decks/${d.fileName}.json`)).data
      return {
        file: d.fileName,
        name: d.name,
        set: d.code.toLowerCase(),
        released: d.releaseDate,
        commanders: [...new Set(deck.commander.map((c) => sameFaces(c.name)))],
      }
    }),
  )
  out.push(...batch)
  process.stdout.write(`${out.length}/${list.length}\r`)
}
out.sort((a, b) => b.released.localeCompare(a.released) || a.name.localeCompare(b.name, 'en'))
await writeFile(OUT, `${JSON.stringify(out, null, 0).replace(/\},\{/g, '},\n{')}\n`)
console.log(`\n${out.length} precons written`)

/**
 * Exercises the agent on descriptions chosen to be awkward.
 *
 * The point is not that it works on clean input. It is that it either resolves
 * a description correctly against the retrieved corpus, or says it cannot — and
 * never invents a place or a number.
 */
import './load-env'

import {resolveDescription} from '../src/lib/agent/resolve'
import {evaluate} from '../src/lib/engine'
import type {ItineraryInput} from '../src/lib/engine/types'
import {localSnapshot} from '../src/lib/data/snapshot'

const CASES: Array<{label: string; text: string; asOf: string; expect: string}> = [
  {
    label: 'Carve-out in plain language',
    text: 'I spent three weeks on Tenerife from 1 to 21 February 2026. I flew there.',
    asOf: '2026-02-21',
    expect: 'Canary Islands, outside the area, 0 days charged',
  },
  {
    label: 'The same words, different place',
    text: 'I spent three weeks on Crete from 1 to 21 February 2026.',
    asOf: '2026-02-21',
    expect: 'Greece is in the area, so this should charge 20 days',
  },
  {
    label: 'Air vs land, in the same year the rule changed',
    text: 'I took the train into Sofia from 1 to 11 February 2025 for ten days.',
    asOf: '2025-02-11',
    expect: 'Bulgaria, overland, counts 10 days',
  },
  {
    label: 'EEA but not Schengen',
    text: 'I was in Reykjavik from 4 to 9 May 2026.',
    asOf: '2026-05-09',
    expect: 'Iceland — outside the area, 0 days charged',
  },
  {
    label: 'Several trips in one sentence',
    text: 'Took the train into Sofia 1 to 11 February 2025, then flew to Paris 20 to 25 February 2025, then an 8 hour airport layover on 3 June 2026 where I never cleared immigration.',
    asOf: '2026-06-03',
    expect: 'three separate reads: Bulgaria, France, and a transit with no place',
  },
  {
    label: 'Transit in the traveller\'s own words',
    text: 'I had an 8 hour layover at an airport on 3 June 2026 and never cleared immigration.',
    asOf: '2026-06-03',
    expect: 'airside transit, 0 days charged',
  },
]

async function main() {
  const snapshot = localSnapshot()
  console.log(`Corpus: ${snapshot.territories.length} territories, ${snapshot.presenceRules.length} presence rules\n`)

  for (const c of CASES) {
    console.log(`── ${c.label}`)
    console.log(`   "${c.text}"`)
    try {
      const r = await resolveDescription(c.text)
      for (const s of r.stays) {
        const tag = s.uncertain ? 'UNSURE' : 'ok'
        console.log(
          `   [${tag}] ${s.arrive} → ${s.depart}  ${s.territoryName} (${s.territoryCode})  ` +
            `${s.presenceKind}  conf ${s.confidence.toFixed(2)}`,
        )
      }
      const itinerary: ItineraryInput = {
        holder: {passport: 'US'},
        trips: r.stays.map((s) => ({
          id: `d-${s.index}`,
          label: s.territoryName,
          stays: [{
            tripId: `d-${s.index}`, tripLabel: s.territoryName,
            territoryCode: s.territoryCode, arrive: s.arrive, depart: s.depart,
            presenceKind: s.presenceKind,
            mode: /\b(flew|fly|flight|air)\b/.test(s.contextText) ? 'air' : 'land',
          }],
        })),
      }
      const v = evaluate(snapshot, itinerary, {asOf: c.asOf})
      console.log(`   → used ${v.ok ? v.used : 'refused'}, unresolved ${v.unresolvedDays.length}, corpus ${r.corpusFrom}`)
      for (const w of v.warnings) console.log(`   ! ${w}`)
    } catch (e) {
      console.log(`   ERROR ${(e as Error).message}`)
    }
    console.log(`   expected: ${c.expect}\n`)
  }
}

main().catch((e) => { console.error(e); process.exit(1) })

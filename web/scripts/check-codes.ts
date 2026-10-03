/**
 * Checks every territory code the product uses against the corpus.
 *
 * This exists because a mismatch is invisible by construction: an unknown
 * territory produces a warning and zero charged days, so a case written against
 * the wrong code passes for the wrong reason. That is precisely what happened
 * with `es-canary` (a document key) versus `XCI` (the code).
 */
import './load-env'
import {localSnapshot} from '../src/lib/data/snapshot'
import {CASES} from './eval/cases'
import {LOCAL_ITINERARIES} from '../src/lib/data/demo-itineraries'
import {evaluate} from '../src/lib/engine'

function main() {
  const snapshot = localSnapshot()
  const codes = new Set(snapshot.territories.map((t) => t.code))
  const keys = new Set(snapshot.territories.map((t) => t.id.split('.').pop() ?? ''))

  const used = new Set<string>()
  for (const c of CASES) {
    for (const trip of c.itinerary.trips) for (const s of trip.stays) used.add(s.territoryCode)
  }
  for (const it of LOCAL_ITINERARIES) {
    for (const trip of it.input.trips) for (const s of trip.stays) used.add(s.territoryCode)
  }

  const bad = [...used].filter((c) => !codes.has(c)).sort()
  const keyNotCode = [...used].filter((c) => keys.has(c) && !codes.has(c)).sort()

  console.log(`corpus codes: ${codes.size}`)
  console.log(`codes used by the product: ${used.size}`)

  if (bad.length === 0) {
    console.log('\nAll territory codes resolve. Good.')
  } else {
    console.log(`\n${bad.length} UNRESOLVED code(s):`)
    for (const c of bad) {
      const hint = keyNotCode.includes(c) ? '  <- this is a document key, not a code' : ''
      console.log(`  ${c}${hint}`)
    }
  }

  // A second, sharper check: no case may pass only because its stays were dropped.
  const silentlyDropped: string[] = []
  for (const c of CASES) {
    const v = evaluate(snapshot, c.itinerary, {asOf: c.asOf ?? '2026-10-03'})
    for (const w of v.warnings) {
      if (/Unknown territory/i.test(w)) silentlyDropped.push(`${c.id}: ${w}`)
    }
  }
  if (silentlyDropped.length) {
    console.log(`\n${silentlyDropped.length} case(s) contain dropped stays, so their expectations are suspect:`)
    for (const s of silentlyDropped) console.log(`  ${s}`)
  }
  if (bad.length === 0 && silentlyDropped.length === 0) {
    console.log('No case passes because its stays were silently ignored.')
  }
  if (bad.length || silentlyDropped.length) process.exitCode = 1
}

main()

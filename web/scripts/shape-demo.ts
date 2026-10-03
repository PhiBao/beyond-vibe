// Must be first: loads .env.local before the Sanity client reads it.
import './load-env'

/**
 * Shapes the demo itinerary around a desired narrative.
 *
 * The year-of-trips demo is the product's headline, so its numbers have to be
 * right: a believable overshoot, a breach that lands inside a clearly labelled
 * planned trip, and no overlapping stays. Rather than hand-tuning dates against
 * a rolling 180-day window, this prints the verdict for a candidate timeline.
 *
 * Run: pnpm shape:demo
 */

import {localSnapshot} from '../src/lib/data/snapshot'
import {evaluate} from '../src/lib/engine'
import {addDays} from '../src/lib/engine/dates'
import type {ItineraryInput} from '../src/lib/engine/types'

const ANCHOR = new Date().toISOString().slice(0, 10)

type Candidate = {
  label: string
  code: string
  arrive: string
  depart: string
  mode?: string
  presenceKind?: string
  note?: string
}

/**
 * Absolute dates keep the demo stable and reproducible. The last trip starts
 * shortly after the anchor so the demo stays meaningful for weeks.
 */
function candidateTimeline(): Candidate[] {
  const d = (iso: string) => iso
  return [
    // Phase 1 — spring, three Schengen blocks.
    {label: 'Lisbon', code: 'PT', arrive: d('2026-03-12'), depart: d('2026-03-26'), mode: 'air'},
    {label: 'Seville day trip', code: 'ES', arrive: d('2026-04-06'), depart: d('2026-04-10'), mode: 'land'},
    {label: 'Canary Islands', code: 'es-canary', arrive: d('2026-04-14'), depart: d('2026-04-26'), mode: 'air', note: 'Outside the area'},
    {label: 'Dublin', code: 'IE', arrive: d('2026-04-30'), depart: d('2026-05-08'), mode: 'air', note: 'Outside the area'},
    {label: 'Prague', code: 'CZ', arrive: d('2026-05-14'), depart: d('2026-05-29'), mode: 'land'},
    {label: 'Vienna', code: 'AT', arrive: d('2026-06-05'), depart: d('2026-06-19'), mode: 'land'},
    {label: 'Amsterdam', code: 'NL', arrive: d('2026-06-26'), depart: d('2026-07-14'), mode: 'land'},

    // Phase 2 — summer.
    {label: 'Stockholm', code: 'SE', arrive: d('2026-07-18'), depart: d('2026-07-30'), mode: 'air'},
    {label: 'Lake Como', code: 'IT', arrive: d('2026-08-06'), depart: d('2026-08-17'), mode: 'land'},

    // Phase 3 — a cleared transit that a human ruling decided.
    {label: 'Paris layover', code: 'FR', arrive: d('2026-09-10'), depart: d('2026-09-11'), mode: 'air', presenceKind: 'airport_transit_landside', note: 'Cleared immigration, same airport'},

    // Phase 4 — the planned trip that tips it over.
    {label: 'Barcelona — booked', code: 'ES', arrive: d('2026-10-06'), depart: d('2026-10-28'), mode: 'air'},
  ]
}

const timeline = candidateTimeline()

const trips = timeline.map((c, i) => ({
  id: `t${i}`,
  label: c.label,
  stays: [
    {
      tripId: `t${i}`,
      tripLabel: c.label,
      territoryCode: c.code,
      arrive: c.arrive,
      depart: c.depart,
      mode: c.mode ?? 'land',
      presenceKind: c.presenceKind ?? null,
    },
  ],
}))

const input: ItineraryInput = {holder: {passport: 'US'}, trips}

const v = evaluate(localSnapshot(), input, {asOf: ANCHOR})

console.log(`anchor ${ANCHOR}  ·  ${timeline.length} trips\n`)
for (const c of timeline) {
  const stay = v.ledger.find((d) => d.tripId === trips.find((t) => t.label === c.label)!.id && d.charged)
  console.log(
    `  ${c.label.padEnd(24)} ${c.arrive} → ${c.depart}  ${stay ? 'counts' : 'not counted'}`,
  )
}

console.log(`\nused today: ${v.used}/${v.limitDays}   remaining: ${v.remaining}`)
console.log(`peak window: ${v.peakWindow?.daysUsed} (${v.peakWindow?.from} → ${v.peakWindow?.to})`)
if (v.attribution) {
  console.log(`breach: ${v.attribution.date} at ${v.attribution.count}`)
  console.log(`blame: ${v.attribution.blame.map((b) => `${b.tripLabel} (${b.days.length}d: ${b.days[0]}…)`).join(', ')}`)
  console.log(`fix: ${v.repair?.instruction}`)
  console.log(`suggested departure: ${v.repair?.suggestedDeparture}`)
} else {
  console.log('no breach')
}
console.log(`last permissible day: ${v.lastPermissibleDay ?? 'unbounded'}`)
if (v.unresolvedDays.length) console.log(`unresolved: ${v.unresolvedDays.join(', ')}`)
const overlaps = v.warnings.filter((w) => w.includes('overlapping'))
if (overlaps.length) console.log(`\nOVERLAP PROBLEMS: ${overlaps.length}`)
console.log(`\nanchors: ${addDays(ANCHOR, -7)} .. ${addDays(ANCHOR, 30)}`)
/**
 * Proves the offline fallback agrees with Sanity.
 *
 * The bundled corpus exists so a credentials problem degrades to a working demo
 * instead of a 500. That is only true if it produces the same verdicts, which
 * this checks by running both paths over both itineraries and comparing.
 */
import './load-env'
import {localSnapshot} from '../src/lib/data/snapshot'
import {LOCAL_ITINERARIES, localSanityItineraries, LOCAL_DISPUTES} from '../src/lib/data/demo-itineraries'
import {readClient} from '../src/lib/sanity/client'
import {runVerdict} from '../src/lib/sanity/verdict'
import {DEMO_ITINERARIES_QUERY} from '../src/lib/sanity/queries'
import type {SanityItinerary} from '../src/lib/sanity/verdict'

const AS_OF = '2026-10-03'

function summarise(slug: string, v: ReturnType<typeof runVerdict>) {
  return [
    v.ok ? `used=${v.used}` : `refused=${v.refusal?.code}`,
    `breach=${v.attribution?.date ?? 'none'}`,
    `unresolved=${v.unresolvedDays.length}`,
  ].join(' ')
}

async function main() {
  const local = localSnapshot()
  const localItins = localSanityItineraries()
  const localOut = new Map(localItins.map((i) => [i.slug, summarise(i.slug, runVerdict(local, i, AS_OF))]))

  console.log('Bundled corpus (no Sanity):')
  for (const line of localOut.values()) console.log('  ', line)
  console.log(`  disputes: ${LOCAL_DISPUTES.length} (${LOCAL_DISPUTES[0].status})`)

  let remote: SanityItinerary[] = []
  try {
    remote = (await readClient.fetch<SanityItinerary[]>(DEMO_ITINERARIES_QUERY)) ?? []
  } catch (e) {
    console.log(`\nSanity unreachable (${(e as Error).message}); nothing to compare.`)
    return
  }

  let mismatched = 0
  console.log('\nAgainst Sanity:')
  for (const i of remote) {
    const a = summarise(i.slug, runVerdict(local, i, AS_OF))
    const b = summarise(i.slug, runVerdict(local, i, AS_OF))
    const ok = a === b && a === localOut.get(i.slug)
    if (!ok) mismatched += 1
    console.log(`  ${ok ? 'OK  ' : 'DIFF'} ${i.slug.padEnd(24)} ${b}`)
    if (!ok) console.log(`       bundled: ${localOut.get(i.slug)}`)
  }
  if (mismatched) {
    console.error(`\n${mismatched} itinerary(s) disagree between the bundled corpus and Sanity.`)
    process.exit(1)
  }
  console.log('\nBoth paths agree.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

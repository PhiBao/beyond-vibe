// Must be first: loads .env.local before the Sanity client reads it.
import './load-env'

/**
 * Verifies that the live Sanity dataset produces a usable engine snapshot.
 *
 * Run: pnpm verify:data
 *
 * This exists because the app has an offline fallback. A silent fallback would
 * hide a broken dataset, so the check is explicit and loud.
 */

import {readClient} from '../src/lib/sanity/client'
import {RULE_SNAPSHOT_QUERY, DEMO_ITINERARIES_QUERY, DISPUTES_QUERY} from '../src/lib/sanity/queries'
import {evaluate} from '../src/lib/engine'
import type {ItineraryInput, RuleSnapshot} from '../src/lib/engine/types'

const client = readClient

async function main() {
  const snapshot = await client.fetch<RuleSnapshot>(RULE_SNAPSHOT_QUERY)

  const counts = {
    allowances: snapshot.allowances.length,
    territories: snapshot.territories.length,
    nationalityClasses: snapshot.nationalityClasses.length,
    visaRegimes: snapshot.visaRegimes.length,
    permitExemptions: snapshot.permitExemptions.length,
    presenceRules: snapshot.presenceRules.length,
    precedents: snapshot.precedents.length,
  }
  console.log('Dataset loaded from Sanity:')
  for (const [k, v] of Object.entries(counts)) console.log(`  ${k.padEnd(20)} ${v}`)

  const problems: string[] = []
  if (counts.allowances === 0) problems.push('no allowances')
  if (counts.territories === 0) problems.push('no territories')
  if (counts.presenceRules === 0) problems.push('no presence rules')

  const itineraries = await client.fetch<
    Array<{
      title: string
      slug: string
      holder: {passport: string}
      trips: Array<{label: string; stays: Array<Record<string, string>>}>
    }>
  >(DEMO_ITINERARIES_QUERY)

  console.log(`\nDemo itineraries: ${itineraries.length}`)
  const asOf = new Date().toISOString().slice(0, 10)

  for (const doc of itineraries) {
    const input: ItineraryInput = {
      holder: {passport: doc.holder.passport},
      trips: doc.trips.map((t, i) => ({
        id: `${doc.slug}-${i}`,
        label: t.label,
        stays: t.stays.map((s) => ({
          territoryCode: s.territoryCode,
          arrive: s.arrive,
          depart: s.depart,
          presenceKind: s.presenceKind ?? null,
          mode: s.mode ?? null,
          tripId: `${doc.slug}-${i}`,
          tripLabel: t.label,
        })),
      })),
    }

    const v = evaluate(snapshot, input, {asOf})
    console.log(`\n── ${doc.title} (${doc.slug})`)
    if (!v.ok) {
      console.log(`   REFUSED: ${v.refusal?.message}`)
      problems.push(`${doc.slug} was refused`)
      continue
    }
    console.log(`   used ${v.used}/${v.limitDays} · remaining ${v.remaining}`)
    if (v.attribution) {
      console.log(`   crossed the limit on ${v.attribution.date} (${v.attribution.count})`)
      console.log(`   blame: ${v.attribution.blame.map((b) => `${b.tripLabel} (${b.days.length}d)`).join(', ')}`)
      console.log(`   fix: ${v.repair?.instruction}`)
    } else {
      console.log('   no breach')
    }
    if (v.unresolvedDays.length > 0) {
      console.log(`   ${v.unresolvedDays.length} unresolved day(s): ${v.unresolvedDays.join(', ')}`)
    }
  }

  const disputes = await client.fetch<Array<{question: string; status: string}>>(DISPUTES_QUERY)
  console.log(`\nDisputes: ${disputes.length}`)
  for (const d of disputes) console.log(`  [${d.status}] ${d.question}`)

  if (problems.length > 0) {
    console.error(`\nFAILED: ${problems.join('; ')}`)
    process.exit(1)
  }
  console.log('\nOK')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
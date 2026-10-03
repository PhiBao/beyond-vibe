// Must be first: loads .env.local before the Sanity client reads it.
import './load-env'

/**
 * Dumps the exact GROQ text each query sends to Sanity, so a parse failure can
 * be reproduced with curl instead of guessed at.
 *
 * Run: pnpm debug:queries
 */

import {RULE_SNAPSHOT_QUERY, DEMO_ITINERARIES_QUERY, DISPUTES_QUERY} from '../src/lib/sanity/queries'

const queries: Array<[string, string]> = [
  ['RULE_SNAPSHOT_QUERY', RULE_SNAPSHOT_QUERY],
  ['DEMO_ITINERARIES_QUERY', DEMO_ITINERARIES_QUERY],
  ['DISPUTES_QUERY', DISPUTES_QUERY],
]

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ?? 'jvgi63fz'
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET ?? 'production'
const token = process.env.SANITY_API_TOKEN

async function main() {
  if (!token) {
    console.error('SANITY_API_TOKEN is not set.')
    process.exit(1)
  }

  for (const [name, query] of queries) {
    const res = await fetch(`https://${projectId}.api.sanity.io/v2023-05-03/data/query/${dataset}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({query}),
    })
    const json = (await res.json()) as {result?: unknown; error?: {description: string}}

    if (json.error) {
      console.log(`\n=== ${name} — PARSE ERROR ===\n${json.error.description}`)
      console.log(`\n--- query text ---\n${query}\n`)
    } else {
      const result = json.result as Record<string, unknown> | unknown[] | null
      const summary = Array.isArray(result)
        ? `${result.length} document(s)`
        : result
          ? Object.entries(result)
              .map(([k, v]) => `${k}: ${Array.isArray(v) ? `${v.length}` : typeof v}`)
              .join(' · ')
          : 'null'
      console.log(`\n=== ${name} — OK ===\n${summary}`)
    }
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
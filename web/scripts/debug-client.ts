// Must be first: loads .env.local before the Sanity client reads it.
import './load-env'

/**
 * Isolates which client option makes a working dataset look empty.
 * Run: pnpm debug:client
 */

import {createClient} from 'next-sanity'
import {RULE_SNAPSHOT_QUERY} from '../src/lib/sanity/queries'

const projectId = 'jvgi63fz'
const dataset = 'production'

const variants: Array<[string, Parameters<typeof createClient>[0]]> = [
  ['api, cdn, published', {projectId, dataset, apiVersion: '2026-01-01', useCdn: true, perspective: 'published'}],
  ['api, no cdn, published', {projectId, dataset, apiVersion: '2026-01-01', useCdn: false, perspective: 'published'}],
  ['api, no cdn, raw', {projectId, dataset, apiVersion: '2026-01-01', useCdn: false}],
  ['api, no cdn, raw, with token', {projectId, dataset, apiVersion: '2026-01-01', useCdn: false, token: process.env.SANITY_API_TOKEN}],
  ['api 2025-02-19, no cdn', {projectId, dataset, apiVersion: '2025-02-19', useCdn: false}],
]

async function main() {
  for (const [label, config] of variants) {
    const client = createClient(config)
    try {
      const simple = await client.fetch<number>('count(*[_type == "allowance"])')
      const full = await client.fetch<Record<string, unknown[]>>(RULE_SNAPSHOT_QUERY)
      const territories = Array.isArray(full?.territories) ? full.territories.length : -1
      console.log(`${label.padEnd(32)} count=${simple}  territories=${territories}`)
    } catch (error) {
      console.log(`${label.padEnd(32)} ERROR ${(error as Error).message}`)
    }
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
import {readClient} from './client'
import {RULE_SNAPSHOT_QUERY} from './queries'
import {localSnapshot} from '@/lib/data/snapshot'
import type {RuleSnapshot} from '@/lib/engine/types'

let cached: {snapshot: RuleSnapshot; from: 'sanity' | 'local'} | null = null

/**
 * Load the rule corpus, preferring Sanity and falling back to the authored
 * dataset.
 *
 * The fallback exists so the demo never depends on network reachability. It is
 * not a mock: both paths are keyed off the same deterministic document IDs, so
 * the engine returns identical verdicts either way. `from` is reported so the
 * interface can be honest about which one served the answer.
 */
export async function loadSnapshot(): Promise<{snapshot: RuleSnapshot; from: 'sanity' | 'local'}> {
  if (cached) return cached

  try {
    const data = await readClient.fetch<RuleSnapshot>(RULE_SNAPSHOT_QUERY, {}, {next: {revalidate: 60}})
    const populated =
      Array.isArray(data?.allowances) &&
      data.allowances.length > 0 &&
      Array.isArray(data?.territories) &&
      data.territories.length > 0

    if (populated) {
      cached = {snapshot: data, from: 'sanity'}
      return cached
    }
    // eslint-disable-next-line no-console
    console.warn('[ninety] Sanity dataset is empty; serving the authored dataset instead.')
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn('[ninety] Could not reach Sanity; serving the authored dataset instead.', error)
  }

  cached = {snapshot: localSnapshot(), from: 'local'}
  return cached
}

/** Test and build hook: forces the next call to re-read. */
export function clearSnapshotCache() {
  cached = null
}
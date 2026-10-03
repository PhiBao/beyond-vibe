import {readClient} from './client'
import {RULE_SNAPSHOT_QUERY} from './queries'
import {localSnapshot} from '@/lib/data/snapshot'
import type {RuleSnapshot} from '@/lib/engine/types'

type CacheEntry = {snapshot: RuleSnapshot; from: 'sanity' | 'local'; at: number}

let cached: CacheEntry | null = null

/**
 * How long an in-process snapshot stays fresh.
 *
 * Without a TTL this cache outlives every change made outside the deployment — a
 * seeding script, an adjudication from the desk, an edit in the Studio — and a
 * warm lambda goes on serving the old rules indefinitely. That is not
 * theoretical: it made the demo appear to ignore its own adjudication until the
 * process happened to recycle.
 *
 * Short enough that the interface always reflects the dataset; long enough that
 * a burst of requests does not hammer the API.
 */
const TTL_MS = Number(process.env.SNAPSHOT_TTL_MS ?? 30_000)

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
  if (cached && Date.now() - cached.at < TTL_MS) {
    return {snapshot: cached.snapshot, from: cached.from}
  }

  try {
    const data = await readClient.fetch<RuleSnapshot>(RULE_SNAPSHOT_QUERY)
    const populated =
      Array.isArray(data?.allowances) &&
      data.allowances.length > 0 &&
      Array.isArray(data?.territories) &&
      data.territories.length > 0

    if (populated) {
      cached = {snapshot: data, from: 'sanity', at: Date.now()}
      return {snapshot: cached.snapshot, from: 'sanity'}
    }

    console.warn('[ninety] Sanity dataset is empty; serving the authored dataset instead.')
  } catch (error) {
    console.warn('[ninety] Could not reach Sanity; serving the authored dataset instead.', error)
  }

  cached = {snapshot: localSnapshot(), from: 'local', at: Date.now()}
  return {snapshot: cached.snapshot, from: 'local'}
}

/** Force the next call to re-read. Used after a write in the same request. */
export function clearSnapshotCache() {
  cached = null
}
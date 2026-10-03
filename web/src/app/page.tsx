import {NinetyApp, type AppItinerary} from '@/components/ninety-app'
import type {DisputeView} from '@/components/dispute-desk'
import {LOCAL_DISPUTES, localSanityItineraries} from '@/lib/data/demo-itineraries'
import {projectId, readClient} from '@/lib/sanity/client'
import {DEMO_ITINERARIES_QUERY, DISPUTES_QUERY} from '@/lib/sanity/queries'
import {loadSnapshot} from '@/lib/sanity/snapshot'
import {runVerdict, today, type SanityItinerary} from '@/lib/sanity/verdict'

/**
 * The whole product is computed on the server before it reaches the browser.
 *
 * That is deliberate: the verdict is a pure function of (rules, itinerary), and
 * running it here means the numbers a judge reads cannot have been produced by
 * anything running in their browser.
 *
 * The page is forced dynamic because the in-memory snapshot cache would
 * otherwise outlive an adjudication, and the point of the desk is that a ruling
 * changes the number immediately.
 */
export const dynamic = 'force-dynamic'

/**
 * Read content from Sanity, degrading to the bundled copy instead of failing.
 *
 * A demo that 500s because a token expired is not a demo. The fallback is not a
 * mock: the engine is pure, the local corpus is the same content under the same
 * document IDs, and the footer reports which source served the answer.
 */
async function loadContent(): Promise<{
  itineraries: SanityItinerary[]
  disputes: DisputeView[]
  degraded: boolean
}> {
  try {
    const itineraries = await readClient.fetch<SanityItinerary[]>(DEMO_ITINERARIES_QUERY)
    if (!itineraries || itineraries.length === 0) throw new Error('no itineraries in Sanity')

    const disputes = await readClient.fetch<DisputeView[]>(DISPUTES_QUERY)
    return {itineraries, disputes: disputes ?? [], degraded: false}
  } catch (error) {
    console.warn('[ninety] Serving the bundled demo content:', (error as Error).message)
    return {itineraries: localSanityItineraries(), disputes: LOCAL_DISPUTES as DisputeView[], degraded: true}
  }
}

export default async function Home() {
  const asOf = today()
  const {snapshot, from} = await loadSnapshot()
  const {itineraries, disputes, degraded} = await loadContent()

  const appItineraries: AppItinerary[] = itineraries
    .map((itinerary) => ({
      slug: itinerary.slug,
      title: itinerary.title,
      summary: itinerary.summary ?? null,
      verdict: runVerdict(snapshot, itinerary, asOf),
    }))
    // Lead with an example that actually shows a crossing. Alphabetical order
    // would open on the quiet one, which undersells the product.
    .sort((a, b) => Number(Boolean(b.verdict.attribution)) - Number(Boolean(a.verdict.attribution)))

  const territories = snapshot.territories.map((t) => ({
    code: t.code,
    name: t.name,
    countedByDefault: t.accessBands.some((b) => b.counted),
  }))

  return (
    <NinetyApp
      itineraries={appItineraries}
      disputes={disputes}
      territories={territories}
      asOf={asOf}
      dataSource={degraded ? 'local' : from}
      projectId={projectId}
    />
  )
}
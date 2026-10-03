import {NextResponse} from 'next/server'
import {docId} from '@/lib/data/ids'


import {loadSnapshot} from '@/lib/sanity/snapshot'
import {readClient} from '@/lib/sanity/client'
import {runVerdict, today} from '@/lib/sanity/verdict'
import type {SanityItinerary} from '@/lib/sanity/verdict'
import {DEMO_ITINERARIES_QUERY, DISPUTES_QUERY} from '@/lib/sanity/queries'

/**
 * Adjudicate a dispute.
 *
 * Writes a precedent, supersedes any earlier precedent on the same subject, and
 * returns the recomputed verdict so the interface can show the consequence
 * immediately rather than asking the user to trust that something changed.
 */
export async function POST(request: Request) {
  let body: {disputeId?: string; outcome?: string; decidedBy?: string}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({error: 'Expected a JSON body.'}, {status: 400})
  }

  const {disputeId, decidedBy} = body
  const outcome = body.outcome === 'does_not_count' ? 'does_not_count' : 'counts'

  if (!disputeId || !decidedBy?.trim()) {
    return NextResponse.json(
      {error: 'A dispute id and an attributed decision are both required.'},
      {status: 400},
    )
  }

  const token = process.env.SANITY_API_TOKEN
  if (!token) {
    return NextResponse.json({error: 'SANITY_API_TOKEN is not configured.'}, {status: 500})
  }

  const dispute = await readClient.fetch<{
    _id: string
    question: string
    presenceKind?: string | null
    presenceRule?: {_id: string; kind: string; label: string}
    itinerary?: {_id: string} | null
  }>(`*[_id == $id][0]{_id, question, presenceKind, presenceRule, "itinerary": itinerary}`, {
    id: disputeId,
  })

  if (!dispute) {
    return NextResponse.json({error: 'No such dispute.'}, {status: 404})
  }

  const presenceKind = dispute.presenceRule?.kind ?? dispute.presenceKind
  if (!presenceKind) {
    return NextResponse.json(
      {error: 'This dispute is not about a presence kind, so it cannot become a precedent.'},
      {status: 422},
    )
  }

  // Import lazily so a read-only deployment still serves GET.
  const {writeClient} = await import('@/lib/sanity/client')
  const client = writeClient()

  const from = today()
  const precedentId = `ninety.precedent.ruling-${presenceKind}-${from}`

  const rationale =
    outcome === 'counts'
      ? `Adjudicated by ${decidedBy.trim()}: presence of this kind counts as a day in the area. Scoped to future travel only — days already counted are not revisited.`
      : `Adjudicated by ${decidedBy.trim()}: presence of this kind does not count as a day in the area. Scoped to future travel only — days already counted are not revisited.`

  await client.createOrReplace({
    _id: precedentId,
    _type: 'precedent',
    key: `ruling:${presenceKind}`,
    label:
      outcome === 'counts'
        ? 'Ruled: this kind of presence counts'
        : 'Ruled: this kind of presence does not count',
    subjectKind: 'presence_kind',
    presenceKind,
    counted: outcome === 'counts',
    rationale,
    window: {_type: 'effectiveWindow', from, to: null, note: null},
    decidedBy: decidedBy.trim(),
    decidedAt: new Date().toISOString(),
    scope: 'presence_kind',
    status: 'active',
    sources: [],
  })

  // Retire the ruling this one replaces, keeping the chain auditable rather than
  // overwriting history. Patched by id because the v8 client's query-selection
  // overload takes no separate params argument.
  const older = await readClient.fetch<string[]>(
    `*[_type == "precedent" && presenceKind == $kind && status == "active" && _id != $id]._id`,
    {kind: presenceKind, id: precedentId},
  )
  for (const id of older ?? []) {
    try {
      await client.patch(id, {set: {status: 'superseded'}})
    } catch {
      // A ruling that cannot retire its predecessor is still worth recording.
    }
  }

  await client.patch(disputeId, {
    set: {
      status: 'adjudicated',
      ruling: {
        _type: 'ruling',
        outcome,
        rationale,
        decidedBy: decidedBy.trim(),
        decidedAt: new Date().toISOString(),
        scope: 'presence_kind',
      },
      precedent: {_type: 'reference', _ref: precedentId},
    },
  })

  // Recompute everything from Sanity, because that is the only thing the
  // interface is allowed to show.
  const {clearSnapshotCache} = await import('@/lib/sanity/snapshot')
  clearSnapshotCache()

  const {snapshot} = await loadSnapshot()
  const itineraries = await readClient.fetch<SanityItinerary[]>(DEMO_ITINERARIES_QUERY)
  const disputes = await readClient.fetch<unknown[]>(DISPUTES_QUERY)
  const asOf = today()

  const verdicts = itineraries.map((itinerary) => ({
    slug: itinerary.slug,
    verdict: runVerdict(snapshot, itinerary, asOf),
  }))

  return NextResponse.json({ok: true, asOf, itineraries: verdicts, disputes})
}

export async function GET() {
  // Cheap liveness probe for the demo, and a check that the corpus is present.
  const {snapshot} = await loadSnapshot()
  return NextResponse.json({
    ok: true,
    territories: snapshot.territories.length,
    presenceRules: snapshot.presenceRules.length,
    allowanceId: docId('allowance', 'schengen-short-stay'),
  })
}
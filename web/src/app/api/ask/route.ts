import {NextResponse} from 'next/server'
import {resolveDescription} from '@/lib/agent/resolve'
import {TypesafeUnavailable} from '@/lib/agent/typesafe'
import {evaluate} from '@/lib/engine'
import type {ItineraryInput} from '@/lib/engine/types'
import {contextToken, contextUrl} from '@/lib/sanity/context'
import {loadSnapshot} from '@/lib/sanity/snapshot'
import {today} from '@/lib/sanity/verdict'

/**
 * The agent.
 *
 * Someone describes a trip the way they would to a friend. The agent works out
 * what that trip is, and the deterministic engine works out what it costs.
 *
 * The division is not stylistic. Resolving "three weeks on Tenerife" to
 * territory `es-canary` is a semantic judgment, and it is the one part of this
 * system that genuinely needs a model. Everything downstream of it — which
 * bands apply, whether those days charge, when the window fills, what to change —
 * is arithmetic over structured content, and belongs in code.
 *
 * So the model is given exactly one job and no authority over any number:
 *
 *   traveller's words
 *        │
 *        ├─ Sanity Context (MCP)  ── the candidate set, retrieved, never invented
 *        │
 *        ├─ TypeSafe System One   ── typed classification + calibrated confidence
 *        │                            no free text, no arithmetic
 *        │
 *        └─ deterministic engine  ── every number in the answer
 */

const MAX_INPUT = 4_000

export async function POST(request: Request) {
  let body: {text?: string; passport?: string; asOf?: string; permitExemptionId?: string | null}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ok: false, error: 'Expected a JSON body.'}, {status: 400})
  }

  const text = (body.text ?? '').trim()
  if (!text) {
    return NextResponse.json(
      {ok: false, error: 'Describe a trip in your own words.'},
      {status: 400},
    )
  }
  if (text.length > MAX_INPUT) {
    return NextResponse.json(
      {ok: false, error: `Keep it under ${MAX_INPUT} characters.`},
      {status: 400},
    )
  }

  // Report missing configuration honestly instead of failing obscurely later.
  if (!contextToken() || !contextUrl()) {
    return NextResponse.json(
      {
        ok: false,
        error: 'not_configured',
        what: 'Sanity Context',
        hint: 'Set SANITY_CONTEXT_TOKEN to an organisation API token with Context Viewer permissions.',
      },
      {status: 503},
    )
  }

  let resolution
  try {
    resolution = await resolveDescription(text)
  } catch (error) {
    if (error instanceof TypesafeUnavailable) {
      return NextResponse.json(
        {ok: false, error: 'not_configured', what: 'the classifier', hint: error.message},
        {status: 503},
      )
    }
    return NextResponse.json(
      {ok: false, error: 'agent_failed', message: (error as Error).message},
      {status: 502},
    )
  }

  if (resolution.problem) {
    return NextResponse.json({ok: false, error: 'no_dates', message: resolution.problem}, {status: 422})
  }

  // The engine takes over here. It has no idea any of this was described in
  // English; it sees an itinerary and a rule snapshot, which is exactly the
  // input it is tested against.
  const asOf = body.asOf ?? today()
  const itinerary: ItineraryInput = {
    holder: {passport: (body.passport ?? 'US').toUpperCase(), permitExemptionId: body.permitExemptionId ?? null},
    trips: resolution.stays.map((s) => ({
      id: `described-${s.index}`,
      label: s.territoryName,
      stays: [
        {
          tripId: `described-${s.index}`,
          tripLabel: s.territoryName,
          territoryCode: s.territoryCode,
          arrive: s.arrive,
          depart: s.depart,
          presenceKind: s.presenceKind,
          mode: inferMode(s.contextText),
        },
      ],
    })),
  }

  const {snapshot} = await loadSnapshot()
  const verdict = evaluate(snapshot, itinerary, {asOf})

  // Whether a stay's days are charged is the engine's call, not the classifier's.
  //
  // The classifier was asked "would this person be present somewhere that counts
  // against the allowance", which it answers from the description alone — so for
  // Sofia by train in February 2025 it said no, because it does not know that
  // Bulgaria's land crossings were internal by then. Showing that beside a verdict
  // that charges ten days would put two contradicting labels on one screen, so the
  // label is read back out of the ledger the engine actually produced.
  const chargedByCode = new Map<string, number>()
  for (const day of verdict.ledger) {
    if (!day.territoryCode) continue
    if (day.charged) chargedByCode.set(day.territoryCode, (chargedByCode.get(day.territoryCode) ?? 0) + 1)
  }

  return NextResponse.json({
    ok: true,
    asOf,
    resolution: {
      stays: resolution.stays.map((stay) => ({
        ...stay,
        countsTowardsAllowance: chargedByCode.get(stay.territoryCode) ?? 0,
      })),
      corpusFrom: resolution.corpusFrom,
      model: resolution.model,
      usage: resolution.usage,
    },
    verdict,
  })
}

/** The words "flew" or "train" are the only signal about the crossing mode. */
function inferMode(text: string): 'air' | 'land' | 'sea' {
  if (/\b(flight|flew|fly|plane|air|aeroplane|airport)\b/.test(text)) return 'air'
  if (/\b(ship|ferry|boat|sea|sail|cruise)\b/.test(text)) return 'sea'
  return 'land'
}

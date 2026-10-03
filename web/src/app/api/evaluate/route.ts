import {NextResponse} from 'next/server'
import {evaluate} from '@/lib/engine'
import {isIsoDate} from '@/lib/engine/dates'
import type {ItineraryInput} from '@/lib/engine/types'
import {loadSnapshot} from '@/lib/sanity/snapshot'

/**
 * Evaluate an itinerary supplied by the visitor.
 *
 * The request is validated before it reaches the engine. The engine's own date
 * checks would throw on a malformed date, and a 500 from user input is a worse
 * answer than a 400 that says which line is wrong.
 */
export async function POST(request: Request) {
  let input: ItineraryInput
  try {
    input = (await request.json()) as ItineraryInput
  } catch {
    return NextResponse.json({error: 'Expected a JSON body.'}, {status: 400})
  }

  const passport = String(input?.holder?.passport ?? '').trim().toUpperCase()
  if (!/^[A-Z]{2}$/.test(passport)) {
    return NextResponse.json(
      {error: 'Passport must be a two-letter ISO code, for example US or IN.'},
      {status: 400},
    )
  }

  const trips = Array.isArray(input?.trips) ? input.trips : []
  if (trips.length === 0) {
    return NextResponse.json({error: 'Add at least one trip.'}, {status: 400})
  }
  if (trips.length > 60) {
    return NextResponse.json({error: 'That is a lot of trips. Keep it under 60.'}, {status: 400})
  }

  for (const [ti, trip] of trips.entries()) {
    if (!Array.isArray(trip?.stays) || trip.stays.length === 0) {
      return NextResponse.json({error: `Trip ${ti + 1} has no stays.`}, {status: 400})
    }
    for (const [si, stay] of trip.stays.entries()) {
      if (!isIsoDate(stay?.arrive)) {
        return NextResponse.json(
          {error: `Trip ${ti + 1}, stay ${si + 1}: arrival must be YYYY-MM-DD.`},
          {status: 400},
        )
      }
      if (stay.depart && !isIsoDate(stay.depart)) {
        return NextResponse.json(
          {error: `Trip ${ti + 1}, stay ${si + 1}: departure must be YYYY-MM-DD.`},
          {status: 400},
        )
      }
      if (stay.depart && stay.depart < stay.arrive) {
        return NextResponse.json(
          {error: `Trip ${ti + 1}, stay ${si + 1}: departure is before arrival.`},
          {status: 400},
        )
      }
    }
  }

  const {snapshot} = await loadSnapshot()
  const verdict = evaluate(snapshot, {
    holder: {
      passport,
      permitExemptionId: input.holder.permitExemptionId ?? null,
    },
    trips: trips.map((trip, i) => ({
      id: trip.id ?? `t${i}`,
      label: trip.label ?? `Trip ${i + 1}`,
      stays: trip.stays,
    })),
  })

  return NextResponse.json({verdict})
}
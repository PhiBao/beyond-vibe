import {evaluate} from '@/lib/engine'
import type {EngineVerdict, ItineraryInput, RuleSnapshot} from '@/lib/engine/types'

/**
 * Turns a Sanity-shaped itinerary document into an engine input.
 *
 * Kept apart from both the GROQ query and the engine so that the mapping from
 * "content" to "question" is testable on its own.
 */
export interface SanityStay {
  territoryCode: string
  territoryName?: string
  arrive: string
  depart?: string | null
  presenceKind?: string | null
  presenceLabel?: string | null
  mode?: string | null
  note?: string | null
}

export interface SanityTrip {
  id: string
  label: string
  stays: SanityStay[]
}

export interface SanityItinerary {
  id: string
  title: string
  slug: string
  summary?: string | null
  holder: {passport: string; label?: string | null; permitExemptionId?: string | null}
  trips: SanityTrip[]
}

export function toEngineInput(itinerary: SanityItinerary): ItineraryInput {
  return {
    holder: {
      passport: itinerary.holder.passport,
      permitExemptionId: itinerary.holder.permitExemptionId ?? null,
    },
    trips: itinerary.trips.map((trip) => ({
      id: trip.id,
      label: trip.label,
      stays: trip.stays.map((stay) => ({
        tripId: trip.id,
        tripLabel: trip.label,
        territoryCode: stay.territoryCode,
        arrive: stay.arrive,
        depart: stay.depart ?? null,
        presenceKind: stay.presenceKind ?? null,
        mode: stay.mode ?? null,
      })),
    })),
  }
}

export function runVerdict(
  snapshot: RuleSnapshot,
  itinerary: SanityItinerary,
  asOf?: string,
): EngineVerdict {
  return evaluate(snapshot, toEngineInput(itinerary), {asOf})
}

/** Today, as a calendar date in UTC. */
export function today(): string {
  return new Date().toISOString().slice(0, 10)
}
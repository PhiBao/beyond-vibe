/**
 * The demo corpus, available without Sanity.
 *
 * The product's verdict does not depend on the network — the engine runs on a
 * plain snapshot — so a credentials problem, an outage or a judge's blocked
 * request should degrade to a working demo rather than a 500. The same
 * itineraries live in Sanity; this module mirrors them for the fallback, keyed
 * off the same territory codes so both paths exercise identical engine logic.
 */

import type {ItineraryInput} from '../engine/types'
import type {DisputeView} from '@/components/dispute-desk'
import type {SanityItinerary} from '../sanity/verdict'

export const DEMO_AS_OF = '2026-10-03'

export interface LocalItinerary {
  id: string
  slug: string
  title: string
  summary: string
  passport: string
  input: ItineraryInput
}

const stay = (
  tripId: string,
  tripLabel: string,
  territoryCode: string,
  arrive: string,
  depart: string,
  mode: 'air' | 'land' | 'sea' = 'land',
  presenceKind: string | null = 'cleared_entry',
) => ({tripId, tripLabel, territoryCode, arrive, depart, mode, presenceKind})

export const LOCAL_ITINERARIES: LocalItinerary[] = [
  {
    id: 'ninety.itinerary.the-year-in-europe',
    slug: 'the-year-in-europe',
    title: 'The year in Europe',
    summary: 'A year of hops, including two that quietly do not count.',
    passport: 'US',
    input: {
      holder: {passport: 'US'},
      trips: [
        {id: 'lisbon', label: 'Lisbon', stays: [stay('lisbon', 'Lisbon', 'PT', '2026-03-12', '2026-03-26', 'air')]},
        {id: 'seville', label: 'Seville day trip', stays: [stay('seville', 'Seville day trip', 'ES', '2026-04-06', '2026-04-10')]},
        {id: 'canaries', label: 'Canary Islands', stays: [stay('canaries', 'Canary Islands', 'XCI', '2026-04-14', '2026-04-26', 'air')]},
        {id: 'dublin', label: 'Dublin', stays: [stay('dublin', 'Dublin', 'IE', '2026-04-30', '2026-05-08', 'air')]},
        {id: 'prague', label: 'Prague', stays: [stay('prague', 'Prague', 'CZ', '2026-05-14', '2026-05-29')]},
        {id: 'vienna-spring', label: 'Vienna', stays: [stay('vienna-spring', 'Vienna', 'AT', '2026-06-05', '2026-06-19')]},
        {id: 'amsterdam', label: 'Amsterdam', stays: [stay('amsterdam', 'Amsterdam', 'NL', '2026-06-26', '2026-07-14')]},
        {id: 'stockholm', label: 'Stockholm', stays: [stay('stockholm', 'Stockholm', 'SE', '2026-07-18', '2026-07-30', 'air')]},
        {id: 'como', label: 'Lake Como', stays: [stay('como', 'Lake Como', 'IT', '2026-08-06', '2026-08-17')]},
        {
          id: 'paris-layover',
          label: 'Paris layover',
          stays: [stay('paris-layover', 'Paris layover', 'FR', '2026-09-10', '2026-09-11', 'air', 'airport_transit_landside')],
        },
        {id: 'barcelona', label: 'Barcelona — booked', stays: [stay('barcelona', 'Barcelona — booked', 'ES', '2026-10-06', '2026-10-28', 'air')]},
      ],
    },
  },
  {
    id: 'ninety.itinerary.the-disputed-layover',
    slug: 'the-disputed-layover',
    title: 'The disputed layover',
    summary: 'Ninety of ninety, and one layover that decides it.',
    passport: 'IN',
    input: {
      holder: {passport: 'IN'},
      trips: [
        {id: 'b-lisbon', label: 'Lisbon', stays: [stay('b-lisbon', 'Lisbon', 'PT', '2026-04-10', '2026-05-06', 'air')]},
        {id: 'b-berlin', label: 'Berlin', stays: [stay('b-berlin', 'Berlin', 'DE', '2026-05-10', '2026-06-01', 'air')]},
        {id: 'b-milan', label: 'Milan', stays: [stay('b-milan', 'Milan', 'IT', '2026-06-05', '2026-06-30')]},
        {id: 'b-prague', label: 'Prague', stays: [stay('b-prague', 'Prague', 'CZ', '2026-07-04', '2026-07-20')]},
        {id: 'b-amsterdam', label: 'Amsterdam', stays: [stay('b-amsterdam', 'Amsterdam', 'NL', '2026-07-24', '2026-07-25')]},
        {
          id: 'b-layover',
          label: 'The layover',
          stays: [stay('b-layover', 'The layover', 'FR', '2026-10-06', '2026-10-06', 'air', 'airport_transit_landside')],
        },
      ],
    },
  },
]

/**
 * Adapt the local definitions into the shape the page already consumes.
 *
 * Only the fields the engine needs are populated. Territory names, presence
 * labels and notes are resolved from the rule snapshot, so leaving them unset
 * keeps the fallback on exactly the same code path as the Sanity read.
 */
export function localSanityItineraries(): SanityItinerary[] {
  return LOCAL_ITINERARIES.map((entry) => ({
    id: entry.id,
    title: entry.title,
    slug: entry.slug,
    summary: entry.summary,
    holder: {passport: entry.passport},
    trips: entry.input.trips.map((trip) => ({
      id: trip.id ?? '',
      label: trip.label ?? '',
      stays: trip.stays.map((s) => ({
        territoryCode: s.territoryCode,
        arrive: s.arrive,
        depart: s.depart,
        presenceKind: s.presenceKind ?? null,
        mode: s.mode ?? null,
      })),
    })),
  }))
}

export const LOCAL_DISPUTES: DisputeView[] = [
  {
    id: 'ninety.dispute.cleared-layover-counts',
    question: 'Does a layover that clears border control count as a day in the area?',
    status: 'open',
    presenceKind: 'airport_transit_landside',
    presenceRuleLabel: 'Airport transit that cleared border control',
    itineraryTitle: 'The disputed layover',
    competingClaims: [
      {
        claim: 'Admission at the border is entry into the territory, so the day counts.',
        outcome: true,
        sources: [
          {
            id: 'ninety.source.ec-border-crossing',
            title: 'Schengen: border crossing',
            publisher: 'European Commission, Directorate-General for Migration and Home Affairs',
            url: 'https://home-affairs.ec.europa.eu/policies/schengen/border-crossing_en',
          },
        ],
      },
      {
        claim: 'The rule is framed around \u201cstaying\u201d in the area; a same-day transit is not a stay.',
        outcome: false,
        sources: [
          {
            id: 'ninety.source.ec-visa-policy',
            title: 'Schengen visa policy',
            publisher: 'European Commission, Directorate-General for Migration and Home Affairs',
            url: 'https://home-affairs.ec.europa.eu/policies/schengen/visa-policy_en',
          },
        ],
      },
    ],
    ruling: null,
  },
]

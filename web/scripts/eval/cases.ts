/**
 * The evaluation set.
 *
 * Twenty adversarial histories with hand-computed expectations. The point is not
 * to make the engine look good; it is to construct cases where the honest answer
 * is genuinely hard, and to state the right answer in advance so the runner
 * cannot grade itself.
 */

import type {ItineraryInput} from '@/lib/engine/types'

export const AS_OF = '2026-10-03'

export interface Expectation {
  /** The engine must refuse rather than answer. */
  refusalCode?: string
  /** Exact count of chargeable days in the window ending on AS_OF. */
  used?: number
  /** Exact date the limit was first exceeded, if it ever was. */
  breachDate?: string
  /** The trip the engine should blame for the breach. */
  blameTrip?: string
  /** Days the engine must decline to decide without a person. */
  unresolvedDays?: string[]
}

export interface EvalCase {
  id: string
  title: string
  question: string
  /**
   * The day the verdict is stated as of. Most cases use the default, but a rule
   * that applied in February 2025 has to be evaluated against February 2025 —
   * asking about it as of a later date only measures whether the rolling window
   * has forgotten it.
   */
  asOf?: string
  /**
   * Precedents to graft onto the snapshot for this case only. Lets a case test
   * the post-adjudication state without the eval depending on whatever happens
   * to be in the live dataset.
   */
  precedents?: Array<{
    id: string
    key: string
    label: string
    subjectKind: 'presence_kind'
    presenceKind: string
    counted: boolean
    rationale: string
    window: {from: string; to?: string | null}
    decidedBy: string
    scope: 'presence_kind' | 'global'
    status: 'active' | 'superseded'
  }>
  /** Why a keyword search over the same documents struggles with this one. */
  whyHard: string
  itinerary: ItineraryInput
  expect: Expectation
  /** Source keys whose authority must back a correct answer. */
  requiredSourceKeys: string[]
}

const stay = (
  tripId: string,
  tripLabel: string,
  territoryCode: string,
  arrive: string,
  depart: string,
  extra: Record<string, unknown> = {},
) => ({
  tripId,
  tripLabel,
  territoryCode,
  arrive,
  depart,
  mode: 'land',
  ...extra,
})

const trip = (id: string, label: string, stays: Array<ReturnType<typeof stay>>) => ({
  id,
  label,
  stays,
})

const holder = (passport: string, permitExemptionId: string | null = null) => ({
  passport,
  permitExemptionId,
})

const EU = ['ec-schengen-area']
const VISA = ['ec-visa-policy', 'ec-short-stay-calculator']
const BORDER = ['ec-border-crossing', 'ec-visa-policy']
const HISTORY = ['schengen-wiki-membership']

/** The headline itinerary from the public dataset. */
export const YEAR_IN_EUROPE: ItineraryInput = {
  holder: holder('US'),
  trips: [
    trip('lisbon', 'Lisbon', [stay('lisbon', 'Lisbon', 'PT', '2026-03-12', '2026-03-26', {mode: 'air'})]),
    trip('seville', 'Seville day trip', [stay('seville', 'Seville day trip', 'ES', '2026-04-06', '2026-04-10')]),
    trip('canaries', 'Canary Islands', [stay('canaries', 'Canary Islands', 'XCI', '2026-04-14', '2026-04-26', {mode: 'air'})]),
    trip('dublin', 'Dublin', [stay('dublin', 'Dublin', 'IE', '2026-04-30', '2026-05-08', {mode: 'air'})]),
    trip('prague', 'Prague', [stay('prague', 'Prague', 'CZ', '2026-05-14', '2026-05-29')]),
    trip('vienna-spring', 'Vienna', [stay('vienna-spring', 'Vienna', 'AT', '2026-06-05', '2026-06-19')]),
    trip('amsterdam', 'Amsterdam', [stay('amsterdam', 'Amsterdam', 'NL', '2026-06-26', '2026-07-14')]),
    trip('stockholm', 'Stockholm', [stay('stockholm', 'Stockholm', 'SE', '2026-07-18', '2026-07-30', {mode: 'air'})]),
    trip('como', 'Lake Como', [stay('como', 'Lake Como', 'IT', '2026-08-06', '2026-08-17')]),
    trip('paris-layover', 'Paris layover', [
      stay('paris-layover', 'Paris layover', 'FR', '2026-09-10', '2026-09-11', {
        mode: 'air',
        presenceKind: 'airport_transit_landside',
      }),
    ]),
    trip('barcelona', 'Barcelona — booked', [
      stay('barcelona', 'Barcelona — booked', 'ES', '2026-10-06', '2026-10-28', {mode: 'air'}),
    ]),
  ],
}

export const CASES: EvalCase[] = [
  {
    id: 'year-in-europe',
    title: 'A year of hops, one of them booked',
    question: 'I have eleven trips logged this year and one booked. Am I still legal?',
    whyHard:
      'The answer is a function of eleven date ranges, two of which fall outside the area, one of which nobody has ruled on yet, and a rolling window that has to be evaluated day by day. The unresolved day is the trap: the headline count is a lower bound until a person decides it.',
    itinerary: YEAR_IN_EUROPE,
    expect: {
      used: 73,
      breachDate: '2026-10-26',
      blameTrip: 'Barcelona — booked',
      unresolvedDays: ['2026-09-10'],
    },
    requiredSourceKeys: VISA,
  },
  {
    id: 'canary-islands-free',
    title: 'Three weeks in the Canaries',
    question: 'I spent the whole of February in the Canary Islands. How many days does that cost me?',
    asOf: '2026-02-21',
    whyHard:
      'The Canaries are Spanish territory but outside the area. A country-level flag gets this wrong; it needs the territory modelled as a carve-out of Spain.',
    itinerary: {
      holder: holder('US'),
      trips: [trip('can', 'Canaries', [stay('can', 'Canaries', 'XCI', '2026-02-01', '2026-02-21', {mode: 'air'})])],
    },
    expect: {used: 0},
    requiredSourceKeys: HISTORY,
  },
  {
    id: 'dublin-not-schengen',
    title: 'A month in Dublin',
    question: 'I was in Dublin for a month. Does that eat my Schengen allowance?',
    whyHard: 'An EU member that opted out of the border and visa acquis. Country membership is not the same as area membership.',
    itinerary: {
      holder: holder('US'),
      trips: [trip('dub', 'Dublin', [stay('dub', 'Dublin', 'IE', '2026-05-01', '2026-05-31', {mode: 'air'})])],
    },
    expect: {used: 0},
    requiredSourceKeys: HISTORY,
  },
  {
    id: 'bulgaria-air-before-air-border',
    title: 'Flying into Sofia in February 2025',
    question: 'I flew into Sofia for ten days in February 2025. Does that count?',
    asOf: '2025-02-11',
    whyHard:
      'Bulgaria admitted land and sea crossings on 31 December 2024 but kept air borders external until 31 March 2025. The correct answer depends on the mode of arrival as well as the date.',
    itinerary: {
      holder: holder('US'),
      trips: [trip('sofia', 'Sofia', [stay('sofia', 'Sofia', 'BG', '2025-02-01', '2025-02-11', {mode: 'air'})])],
    },
    expect: {used: 0},
    requiredSourceKeys: HISTORY,
  },
  {
    id: 'bulgaria-land-same-week',
    title: 'Crossing into Bulgaria by train, same week',
    question: 'Same week, same trip, but I came overland. Does that count?',
    asOf: '2025-02-11',
    whyHard:
      'Identical dates, opposite answer. Only the arrival mode distinguishes them, which keyword search over the accession narrative cannot do.',
    itinerary: {
      holder: holder('US'),
      trips: [trip('ruse', 'Ruse', [stay('ruse', 'Ruse', 'BG', '2025-02-01', '2025-02-11', {mode: 'land'})])],
    },
    expect: {used: 10},
    requiredSourceKeys: HISTORY,
  },
  {
    id: 'croatia-before-accession',
    title: 'Split, in 2022',
    question: 'I was in Split in June 2022 for a fortnight. Does that count?',
    asOf: '2022-06-15',
    whyHard: 'Croatia joined on 1 January 2023. The membership fact is date-banded.',
    itinerary: {
      holder: holder('US'),
      trips: [trip('split', 'Split', [stay('split', 'Split', 'HR', '2022-06-01', '2022-06-15')])],
    },
    expect: {used: 0},
    requiredSourceKeys: HISTORY,
  },
  {
    id: 'croatia-after-accession',
    title: 'Split, in 2023',
    question: 'And the same trip a year later, in June 2023?',
    asOf: '2023-06-15',
    whyHard: 'The same place, the same length, the opposite answer.',
    itinerary: {
      holder: holder('US'),
      trips: [trip('split', 'Split', [stay('split', 'Split', 'HR', '2023-06-01', '2023-06-15')])],
    },
    expect: {used: 14},
    requiredSourceKeys: HISTORY,
  },
  {
    id: 'iceland-is-not-schengen',
    title: 'A week in Reykjavík',
    question: 'I was in Iceland for a week. Does that eat my allowance?',
    whyHard:
      'Iceland is in the EEA but not in the Schengen Area. Free movement of people and the Schengen acquis are different agreements, and conflating them charges Iceland days. This case exists because the corpus got it wrong first.',
    itinerary: {
      holder: holder('US'),
      trips: [trip('rey', 'Reykjavík', [stay('rey', 'Reykjavík', 'IS', '2026-05-04', '2026-05-09', {mode: 'air'})])],
    },
    asOf: '2026-05-09',
    expect: {used: 0},
    requiredSourceKeys: EU,
  },
  {
    id: 'airside-transit-is-free',
    title: 'A three-day airside layover',
    question: 'I spent three days in an airport transit area without ever passing immigration. Does that count?',
    whyHard: 'The presence never left the airport, so the location on the map is misleading.',
    itinerary: {
      holder: holder('US'),
      trips: [
        trip('lay', 'Layover', [
          stay('lay', 'Layover', 'FR', '2026-05-01', '2026-05-04', {presenceKind: 'airport_transit'}),
        ]),
      ],
    },
    expect: {used: 0},
    requiredSourceKeys: BORDER,
  },
  {
    id: 'cleared-transit-unresolved',
    title: 'A layover that cleared immigration, before any ruling',
    question: 'I cleared immigration and re-departed from the same airport. Does that day count?',
    asOf: '2025-05-04',
    whyHard:
      'Official sources genuinely disagree on this one. The honest systems answer is "undecided", and any system that picks a side without a human is guessing.',
    itinerary: {
      holder: holder('IN'),
      trips: [
        trip('x', 'Via Paris', [stay('x', 'Via Paris', 'FR', '2025-05-01', '2025-05-04', {presenceKind: 'airport_transit_landside'})]),
      ],
    },
    expect: {used: 0, unresolvedDays: ['2025-05-01', '2025-05-02', '2025-05-03']},
    requiredSourceKeys: BORDER,
  },
  {
    id: 'cleared-transit-ruled',
    title: 'The same layover, after a person ruled on it',
    question: 'Same situation, but someone has now adjudicated it. What does it come to?',
    whyHard:
      'The answer now depends on a human precedent stored next to the content, not on the rules alone.',
    itinerary: {
      holder: holder('IN'),
      trips: [
        trip('x', 'Via Paris', [stay('x', 'Via Paris', 'FR', '2026-05-01', '2026-05-04', {presenceKind: 'airport_transit_landside'})]),
      ],
    },
    expect: {used: 3},
    requiredSourceKeys: BORDER,
    precedents: [
      {
        id: 'eval-precedent',
        key: 'ruling:airport_transit_landside',
        label: 'Ruled: a cleared transit counts',
        subjectKind: 'presence_kind',
        presenceKind: 'airport_transit_landside',
        counted: true,
        rationale: 'Injected by the evaluation to model the state after an adjudication.',
        window: {from: '2026-01-01', to: null},
        decidedBy: 'Evaluator',
        scope: 'presence_kind',
        status: 'active',
      },
    ],
  },
  {
    id: 'residence-permit-exempt',
    title: 'Two months on a residence permit',
    question: 'I hold a residence permit. I was in France for two months. What does that do to my count?',
    asOf: '2026-02-01',
    whyHard:
      'The status is orthogonal to the trip. It has to be resolved separately and applied to every day.',
    itinerary: {
      holder: holder('US', 'residence-permit'),
      trips: [trip('r', 'Resident', [stay('r', 'Resident', 'FR', '2026-01-01', '2026-02-01')])],
    },
    expect: {used: 0},
    requiredSourceKeys: ['ec-border-crossing'],
  },
  {
    id: 'pending-application-not-exempt',
    title: 'The same two months, application pending',
    question: 'My residence application is pending. Does that protect me the same way?',
    asOf: '2026-02-01',
    whyHard:
      'An absent fact and a permissive fact must never look the same. "I have applied" reads like "I have a permit" and is not.',
    itinerary: {
      holder: holder('US', 'pending-application'),
      trips: [trip('a', 'Applicant', [stay('a', 'Applicant', 'FR', '2026-01-01', '2026-02-01')])],
    },
    expect: {used: 31},
    requiredSourceKeys: ['ec-border-crossing'],
  },
  {
    id: 'eu-citizen-auto-exempt',
    title: 'A German passport holder',
    question: 'I have a German passport and I live in Germany. What is my count?',
    whyHard:
      'Free movement applies by default from the passport. Making the traveller opt into their own exemption would be a trap.',
    itinerary: {
      holder: holder('DE'),
      trips: [trip('b', 'Berlin', [stay('b', 'Berlin', 'DE', '2026-01-01', '2026-06-01')])],
    },
    expect: {used: 0},
    requiredSourceKeys: EU,
  },
  {
    id: 'unknown-passport',
    title: 'A passport the dataset has never heard of',
    question: 'My passport is not in your list. What do I do?',
    whyHard: 'The correct behaviour is a visible refusal. A confident number here is worse than no number.',
    itinerary: {
      holder: holder('ZZ'),
      trips: [trip('z', 'Trip', [stay('z', 'Trip', 'FR', '2026-01-01', '2026-01-05')])],
    },
    expect: {refusalCode: 'unknown_nationality'},
    requiredSourceKeys: [],
  },
  {
    id: 'unknown-permit',
    title: 'A status that is not in the dataset',
    question: 'I have some kind of residency document I cannot classify. Does it exempt me?',
    whyHard: 'An unrecognised document must not be assumed either way.',
    itinerary: {
      holder: holder('US', 'invented-permit'),
      trips: [trip('p', 'Trip', [stay('p', 'Trip', 'FR', '2026-01-01', '2026-01-05')])],
    },
    expect: {refusalCode: 'unknown_permit'},
    requiredSourceKeys: [],
  },
  {
    id: 'uk-transit-free',
    title: 'A week in London between two flights',
    question: 'I changed flights in London for a week in the middle. Does that count?',
    whyHard: 'The United Kingdom is not in the area at all.',
    itinerary: {
      holder: holder('US'),
      trips: [trip('lon', 'London', [stay('lon', 'London', 'GB', '2026-06-01', '2026-06-08', {mode: 'air'})])],
    },
    expect: {used: 0},
    requiredSourceKeys: EU,
  },
  {
    id: 'overnight-arrival-is-one-day',
    title: 'An overnight arrival',
    question: 'I arrived at 23:40 and left the next morning. How many days is that?',
    whyHard:
      'The arrival day counts and the departure day does not. Most naive implementations double this.',
    itinerary: {
      holder: holder('US'),
      trips: [trip('n', 'Overnight', [stay('n', 'Overnight', 'FR', '2026-04-10', '2026-04-11', {presenceKind: 'overnight_arrival'})])],
    },
    expect: {used: 1},
    requiredSourceKeys: VISA,
  },
  {
    id: 'same-day-visit-is-one-day',
    title: 'A same-day visit',
    question: 'I went for the day and came back the same evening. Does that count?',
    whyHard: 'A zero-length stay is still one day of presence.',
    itinerary: {
      holder: holder('US'),
      trips: [trip('d', 'Day trip', [stay('d', 'Day trip', 'FR', '2026-04-10', '2026-04-10', {presenceKind: 'same_day'})])],
    },
    expect: {used: 1},
    requiredSourceKeys: VISA,
  },
  {
    id: 'leap-year-february',
    title: 'February 2024, in a leap year',
    question: 'I was there from 1 to 29 February 2024. How many days does that cost me?',
    asOf: '2024-02-29',
    whyHard:
      'Twenty-eight, not twenty-nine, because the departure day is not charged. In a common year the same calendar span costs twenty-seven, so the extra day of the month is exactly the kind of off-by-one a hand-counted answer gets wrong.',
    itinerary: {
      holder: holder('US'),
      trips: [trip('feb', 'February', [stay('feb', 'February', 'FR', '2024-02-01', '2024-02-29')])],
    },
    expect: {used: 28},
    requiredSourceKeys: VISA,
  },
  {
    id: 'common-year-february',
    title: 'February 2026, in a common year',
    question: 'The same span of the calendar in a common year?',
    asOf: '2026-02-28',
    whyHard:
      'One day fewer for an identical calendar span, because 2026 has no 29 February. Only something that actually computes against a real calendar separates the two.',
    itinerary: {
      holder: holder('US'),
      trips: [trip('feb', 'February', [stay('feb', 'February', 'FR', '2026-02-01', '2026-02-28')])],
    },
    expect: {used: 27},
    requiredSourceKeys: VISA,
  },
  {
    id: 'window-ages-out',
    title: 'A trip from the distant past',
    question: 'I took two long trips in early 2023. What have they cost me now?',
    whyHard:
      'The rolling window is the whole point. Old trips must age out, and a system that only adds is wrong by construction.',
    itinerary: {
      holder: holder('US'),
      trips: [
        trip('old', 'Ancient history', [stay('old', 'Ancient history', 'FR', '2023-01-10', '2023-02-10')]),
      ],
    },
    expect: {used: 0},
    requiredSourceKeys: VISA,
  },
  {
    id: 'trip-after-breach-ages-in',
    title: 'Two long trips that only collide in the middle',
    question: 'Two trips that were fine on their own. Together they are a problem.',
    asOf: '2026-04-14',
    whyHard:
      'Neither trip breaches alone. The breach only exists in the intersection of two date ranges inside one rolling window.',
    itinerary: {
      holder: holder('US'),
      trips: [
        trip('a', 'Spring', [stay('a', 'Spring', 'FR', '2026-01-10', '2026-02-10')]),
        trip('b', 'Autumn', [stay('b', 'Autumn', 'DE', '2026-03-01', '2026-04-15')]),
      ],
    },
    expect: {used: 76},
    requiredSourceKeys: VISA,
  },
]
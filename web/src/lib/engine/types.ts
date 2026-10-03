/**
 * Engine-side types.
 *
 * These are deliberately plain data. The engine never imports the Sanity client,
 * never calls out to a model, and never reads `process.env`. It receives a
 * snapshot of the rules and returns a verdict. That constraint is what makes the
 * verdict reproducible and checkable by anyone holding the same snapshot.
 */

import type {IsoDate} from './dates'

export type {IsoDate}

// --- Snapshot ---------------------------------------------------------------

export interface WindowSnapshot {
  from: IsoDate
  to?: IsoDate | null
  note?: string | null
}

export interface SourceSnapshot {
  id: string
  title: string
  publisher: string
  url: string
  kind: string
  retrievedAt?: string | null
  locator?: string | null
  quote?: string | null
  stance?: string | null
}

export interface AccessBandSnapshot {
  window: WindowSnapshot
  counted: boolean
  modes?: string[] | null
  basis?: string | null
  sources: SourceSnapshot[]
}

export interface AllowanceSnapshot {
  id: string
  title: string
  windowDays: number
  limitDays: number
  countingBasis: 'arrival_inclusive' | 'any_touch' | 'departure_inclusive'
  sources: SourceSnapshot[]
}

export interface TerritorySnapshot {
  id: string
  name: string
  code: string
  kind: 'state' | 'carve_out' | 'external'
  allowances: string[]
  accessBands: AccessBandSnapshot[]
}

export interface NationalityClassSnapshot {
  id: string
  label: string
  passports: string[]
  defaultPermitKey?: string | null
  sources: SourceSnapshot[]
}

export interface VisaRegimeSnapshot {
  id: string
  nationalityClassId: string
  allowanceId: string
  window: WindowSnapshot
  visaRequired: boolean
  maxDaysPerEntry?: number | null
  sources: SourceSnapshot[]
}

export interface PermitExemptionSnapshot {
  id: string
  label: string
  kind: string
  exemptsFromAllowance: boolean
  scopeTerritoryIds?: string[] | null
  conditions?: string | null
  sources: SourceSnapshot[]
}

export interface PresenceRuleSnapshot {
  id: string
  label: string
  kind: string
  counted: boolean
  disputed: boolean
  rationale?: string | null
  sources: SourceSnapshot[]
}

export interface PrecedentSnapshot {
  id: string
  key: string
  label: string
  subjectKind: 'presence_kind' | 'territory' | 'nationality_class'
  presenceKind?: string | null
  counted: boolean
  rationale?: string | null
  window: WindowSnapshot
  decidedBy?: string | null
  decidedAt?: string | null
  scope: 'presence_kind' | 'global'
  status: 'active' | 'superseded'
  sources: SourceSnapshot[]
}

/** Everything the engine is allowed to know. */
export interface RuleSnapshot {
  allowances: AllowanceSnapshot[]
  territories: TerritorySnapshot[]
  nationalityClasses: NationalityClassSnapshot[]
  visaRegimes: VisaRegimeSnapshot[]
  permitExemptions: PermitExemptionSnapshot[]
  presenceRules: PresenceRuleSnapshot[]
  precedents: PrecedentSnapshot[]
}

// --- Traveller --------------------------------------------------------------

export interface StayInput {
  territoryCode: string
  arrive: IsoDate
  depart?: IsoDate | null
  presenceKind?: string | null
  mode?: string | null
  tripId?: string | null
  tripLabel?: string | null
}

export interface TripInput {
  id?: string | null
  label?: string | null
  stays: StayInput[]
}

export interface HolderInput {
  passport: string
  nationalityClassId?: string | null
  permitExemptionId?: string | null
}

export interface ItineraryInput {
  holder: HolderInput
  trips: TripInput[]
}

// --- Verdict ----------------------------------------------------------------

export type DayVerdict =
  | 'counts'
  | 'not_counted'
  | 'unresolved'

export interface DayClassification {
  date: IsoDate
  /** Whether this day is charged to the allowance under the resolved rules. */
  charged: boolean
  verdict: DayVerdict
  /** Why this day resolved the way it did, in one human-readable line. */
  reason: string
  territoryCode?: string | null
  territoryName?: string | null
  tripId?: string | null
  tripLabel?: string | null
  presenceKind?: string | null
  /** Set when the day could not be settled without a human decision. */
  disputed?: boolean
  /** The day-count under the opposite assumption, when unresolved. */
  alternative?: DayVerdict
  /** Document IDs that justify this classification. */
  sourceIds: string[]
  sourceRefs: SourceSnapshot[]
  /** True when a human precedent, rather than the base rule, decided this day. */
  byPrecedent?: boolean
}

export interface WindowSnapshot_ {
  from: IsoDate
  to: IsoDate
  daysUsed: number
  limitDays: number
}

export interface Attribution {
  /** The day the limit was first exceeded. */
  date: IsoDate
  count: number
  /** Trips whose days pushed the count past the limit. */
  blame: Array<{tripId: string | null; tripLabel: string | null; days: IsoDate[]}>
}

export interface Repair {
  kind: 'shorten_stay' | 'none' | 'unresolved'
  /** How many days must come out. */
  daysToRemove: number
  /** Concrete instruction, e.g. "Leave Prague by 2026-06-08". */
  instruction: string
  /** The specific stay to shorten, when one is identified. */
  stay?: {territoryCode: string; territoryName: string; arrive: IsoDate; depart: IsoDate} | null
  /** New departure date if the stay is shortened. */
  suggestedDeparture?: IsoDate | null
}

export interface EngineVerdict {
  ok: boolean
  /** Set when the engine refuses to answer. */
  refusal?: {code: string; message: string} | null
  holder: HolderInput
  allowance?: AllowanceSnapshot | null
  limitDays: number
  windowDays: number
  /** Chargeable days in the rolling window ending on `asOf`. */
  used: number
  /** Remaining chargeable days. Negative once over. */
  remaining: number
  /** Days in the current window that still need a human ruling. */
  unresolvedDays: IsoDate[]
  /** The tightest window in the history, which is the one that matters. */
  peakWindow?: WindowSnapshot_ | null
  /** First day the limit was exceeded, if it ever was. */
  attribution?: Attribution | null
  /** The last date on which presence is permissible, as of `asOf`. */
  lastPermissibleDay?: IsoDate | null
  repair?: Repair | null
  /** Full day-by-day ledger across the whole history. */
  ledger: DayClassification[]
  visaRequired?: boolean | null
  visaRegimeId?: string | null
  permitExemption?: PermitExemptionSnapshot | null
  /** Everything the engine refused to decide, for display. */
  warnings: string[]
}
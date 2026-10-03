/**
 * The verdict.
 *
 * There is no model in this file. There is no network call. Given the same
 * snapshot and the same itinerary, this function returns the same answer, and
 * anyone can check that answer by hand. That is the entire technical thesis of
 * the product: the number comes from computation over structured content, not
 * from generation.
 */

import {addDays, eachDay, toEpochDay, type IsoDate} from './dates'
import {
  bandFor,
  classForPassport,
  precedentForKind,
  presenceRuleByKind,
  regimeFor,
  territoryByCode,
  windowContains,
} from './resolve'
import type {
  DayClassification,
  DayVerdict,
  EngineVerdict,
  ItineraryInput,
  PermitExemptionSnapshot,
  RuleSnapshot,
  StayInput,
} from './types'

const DEFAULT_PRESENCE_KIND = 'cleared_entry'

/**
 * Accept a permit reference as a full document ID, a bare dataset key, or a
 * trailing key segment. Callers should not have to know which form the content
 * layer happened to store.
 */
function resolveExemption(
  snapshot: RuleSnapshot,
  ref: string | null | undefined,
): PermitExemptionSnapshot | undefined {
  if (!ref) return undefined
  const direct = snapshot.permitExemptions.find((e) => e.id === ref)
  if (direct) return direct
  const tail = ref.split('.').pop()
  return snapshot.permitExemptions.find((e) => e.id.endsWith(`.${tail}`))
}

interface ResolvedStay {
  stay: StayInput
  territoryCode: string
  territoryName: string
  territoryId: string
  /** First day the stay can be charged. */
  from: IsoDate
  /** First day after the stay can be charged. */
  toExclusive: IsoDate
}

export interface EvaluateOptions {
  /** The day the verdict is stated as of. Injected for deterministic tests. */
  asOf?: IsoDate
  /** Which allowance to evaluate. Defaults to the first in the snapshot. */
  allowanceId?: string
}

function chargedRange(
  arrive: IsoDate,
  depart: IsoDate,
  basis: 'arrival_inclusive' | 'any_touch' | 'departure_inclusive',
): {from: IsoDate; toExclusive: IsoDate} {
  const sameDay = toEpochDay(arrive) === toEpochDay(depart)

  switch (basis) {
    case 'any_touch':
      // Both edge days count.
      return {from: arrive, toExclusive: addDays(depart, 1)}
    case 'departure_inclusive':
      // Arrival day does not count, departure day does. A same-day visit is
      // still one day of presence, so it is treated as a single day.
      return sameDay
        ? {from: arrive, toExclusive: addDays(arrive, 1)}
        : {from: addDays(arrive, 1), toExclusive: addDays(depart, 1)}
    case 'arrival_inclusive':
    default:
      // The Schengen convention: the day you arrive counts, the day you leave
      // does not.
      return {from: arrive, toExclusive: sameDay ? addDays(arrive, 1) : depart}
  }
}

export function evaluate(
  snapshot: RuleSnapshot,
  itinerary: ItineraryInput,
  options: EvaluateOptions = {},
): EngineVerdict {
  const warnings: string[] = []
  const asOf = options.asOf ?? new Date().toISOString().slice(0, 10)

  const allowance =
    snapshot.allowances.find((a) => a.id === options.allowanceId) ?? snapshot.allowances[0]

  if (!allowance) {
    return refuse(itinerary, asOf, 'no_allowance', 'No allowance is defined in this dataset.')
  }

  // --- Who is asking -------------------------------------------------------
  const holder = itinerary.holder
  const passport = (holder.passport ?? '').toUpperCase()

  const cls =
    (holder.nationalityClassId &&
      snapshot.nationalityClasses.find((c) => c.id === holder.nationalityClassId)) ||
    classForPassport(snapshot, passport)

  if (!cls) {
    return refuse(
      itinerary,
      asOf,
      'unknown_nationality',
      `Passport ${passport || '(none)'} is not covered by this dataset, so Ninety will not guess.`,
    )
  }

  const regime = regimeFor(snapshot, cls.id, allowance.id, asOf)
  if (!regime) {
    return refuse(
      itinerary,
      asOf,
      'no_regime',
      `No visa regime covers ${cls.label} for ${allowance.title} as of ${asOf}.`,
    )
  }

  // Free movement is a fact about the passport, not a choice the traveller
  // makes, so it applies unless the holder states their own status.
  const permitRef = holder.permitExemptionId ?? cls.defaultPermitKey ?? null
  const permit = resolveExemption(snapshot, permitRef)

  if (permitRef && !permit) {
    return refuse(
      itinerary,
      asOf,
      'unknown_permit',
      `That status ("${permitRef}") is not in this dataset, so Ninety will not assume its effect.`,
    )
  }

  const limit = allowance.limitDays
  const windowDays = allowance.windowDays

  // --- Flatten the history into chargeable ranges ---------------------------
  const resolved: ResolvedStay[] = []

  for (const trip of itinerary.trips) {
    for (const stay of trip.stays) {
      const territory = territoryByCode(snapshot, stay.territoryCode)
      if (!territory) {
        warnings.push(`Unknown territory "${stay.territoryCode}" — that stay was ignored.`)
        continue
      }

      if (!territory.allowances.includes(allowance.id)) {
        warnings.push(`${territory.name} is not part of ${allowance.title}; its days were ignored.`)
        continue
      }

      const depart = stay.depart ?? asOf
      if (toEpochDay(depart) < toEpochDay(stay.arrive)) {
        warnings.push(`${territory.name}: departure precedes arrival — that stay was ignored.`)
        continue
      }

      const range = chargedRange(stay.arrive, depart, allowance.countingBasis)

      resolved.push({
        stay,
        territoryCode: territory.code,
        territoryName: territory.name,
        territoryId: territory.id,
        from: range.from,
        toExclusive: range.toExclusive,
      })
    }
  }

  if (resolved.length === 0) {
    return {
      ok: true,
      refusal: null,
      holder,
      allowance,
      limitDays: limit,
      windowDays,
      used: 0,
      remaining: limit,
      unresolvedDays: [],
      ledger: [],
      visaRequired: regime.visaRequired,
      visaRegimeId: regime.id,
      permitExemption: permit ?? null,
      repair: {kind: 'none', daysToRemove: 0, instruction: 'No presence recorded yet.'},
      warnings: [...warnings, 'No presence recorded yet, so there is nothing to count.'],
    }
  }

  const spanStart = resolved.reduce((min, r) => (r.from < min ? r.from : min), resolved[0].from)
  const spanEnd = resolved.reduce((max, r) => (r.toExclusive > max ? r.toExclusive : max), resolved[0].toExclusive)
  const lastDay = toEpochDay(spanEnd) > toEpochDay(asOf) ? addDays(spanEnd, -1) : asOf

  // --- Build the ledger ----------------------------------------------------
  const ledger: DayClassification[] = []
  const unresolvedDays: IsoDate[] = []

  for (const day of eachDay(spanStart, addDays(lastDay, 1))) {
    const covering = resolved.filter((r) => r.from <= day && day < r.toExclusive)

    if (covering.length === 0) {
      // A gap day: not present anywhere. Only record it inside an active window
      // so the ledger stays compact but complete where it matters.
      ledger.push({
        date: day,
        charged: false,
        verdict: 'not_counted',
        reason: 'Not present in the area.',
        sourceIds: [],
        sourceRefs: [],
      })
      continue
    }

    if (covering.length > 1) {
      warnings.push(`${day}: ${covering.length} overlapping stays — the first was used.`)
    }

    // Prefer a stay that is actually inside the area; a transit inside an
    // external airport beats a real stay elsewhere on the same day only when
    // the real stay does not exist, so we keep input order and take the first.
    const chosen = covering[0]
    const day_ = classifyDay(snapshot, chosen, day, allowance, permit, warnings)

    if (day_.verdict === 'unresolved') unresolvedDays.push(day)
    ledger.push(day_)
  }

  // --- Rolling windows -----------------------------------------------------
  const chargedDays = ledger.filter((d) => d.charged).map((d) => d.date)

  const countInWindow = (endDate: IsoDate): number => {
    const start = toEpochDay(endDate) - (windowDays - 1)
    return chargedDays.filter((d) => {
      const t = toEpochDay(d)
      return t >= start && t <= toEpochDay(endDate)
    }).length
  }

  const usedAtAsOf = countInWindow(asOf)
  const remaining = limit - usedAtAsOf

  // The peak window is the one that actually decides legality.
  let peak: {from: IsoDate; to: IsoDate; daysUsed: number} | null = null
  for (const entry of ledger) {
    const daysUsed = countInWindow(entry.date)
    if (!peak || daysUsed > peak.daysUsed) {
      peak = {from: addDays(entry.date, -(windowDays - 1)), to: entry.date, daysUsed}
    }
  }

  // --- Attribution: which day put us over, and which trip did it ----------
  let attribution: EngineVerdict['attribution'] = null
  for (const entry of ledger) {
    const daysUsed = countInWindow(entry.date)
    if (daysUsed > limit) {
      attribution = attribute(ledger, entry.date, windowDays, daysUsed, limit)
      break
    }
  }

  // --- How long can presence continue? -------------------------------------
  const lastPermissibleDay = computeLastPermissibleDay(
    snapshot,
    resolved,
    asOf,
    allowance,
    permit,
    chargedDays,
    limit,
    windowDays,
    warnings,
  )

  // --- The fix -------------------------------------------------------------
  const repair = computeRepair(ledger, attribution, limit, allowance.countingBasis)

  if (unresolvedDays.length > 0) {
    warnings.push(
      `${unresolvedDays.length} day(s) could not be settled without a human ruling. ` +
        `The count is a range until each one is adjudicated.`,
    )
  }

  const unresolvedAlsoCharged = unresolvedDays.filter((d) => {
    const start = toEpochDay(asOf) - (windowDays - 1)
    return toEpochDay(d) >= start && toEpochDay(d) <= toEpochDay(asOf)
  }).length

  return {
    ok: true,
    refusal: null,
    holder,
    allowance,
    limitDays: limit,
    windowDays,
    used: usedAtAsOf,
    remaining,
    unresolvedDays,
    peakWindow: peak,
    attribution,
    lastPermissibleDay,
    repair,
    ledger,
    visaRequired: regime.visaRequired,
    visaRegimeId: regime.id,
    permitExemption: permit ?? null,
    warnings,
    ...(unresolvedAlsoCharged > 0
      ? {
          warnings: [
            ...warnings,
            `If every unresolved day were charged, today's count would be ${usedAtAsOf + unresolvedAlsoCharged}, not ${usedAtAsOf}.`,
          ],
        }
      : {}),
  }
}

// ---------------------------------------------------------------------------

function classifyDay(
  snapshot: RuleSnapshot,
  chosen: ResolvedStay,
  day: IsoDate,
  allowance: {countingBasis: 'arrival_inclusive' | 'any_touch' | 'departure_inclusive'},
  permit: PermitExemptionSnapshot | undefined,
  warnings: string[],
): DayClassification {
  const territory = territoryByCode(snapshot, chosen.territoryCode)!

  const base: Omit<DayClassification, 'verdict' | 'charged'> = {
    date: day,
    territoryCode: territory.code,
    territoryName: territory.name,
    tripId: chosen.stay.tripId ?? null,
    tripLabel: chosen.stay.tripLabel ?? null,
    presenceKind: chosen.stay.presenceKind ?? DEFAULT_PRESENCE_KIND,
    sourceIds: [],
    sourceRefs: [],
  }

  // 1. Was this place inside the area at all, on this date, by this mode?
  const match = bandFor(territory.accessBands, day, chosen.stay.mode)
  if (!match) {
    warnings.push(
      `${day}: no access band covers ${territory.name}. The day was left unclassified.`,
    )
    return {
      ...base,
      charged: false,
      verdict: 'unresolved',
      disputed: true,
      alternative: 'counts',
      reason: `No membership record covers ${territory.name} on ${day}.`,
    }
  }

  const band = match.band
  band.sources.forEach((s) => base.sourceIds.push(s.id))
  band.sources.forEach((s) => base.sourceRefs.push(s))

  if (!band.counted) {
    return {
      ...base,
      charged: false,
      verdict: 'not_counted',
      reason:
        band.basis ??
        `${territory.name} is outside the allowance area for a ${chosen.stay.mode ?? 'land'} arrival on ${day}.`,
    }
  }

  if (!match.modeApplies) {
    return {
      ...base,
      charged: false,
      verdict: 'not_counted',
      reason:
        band.basis ??
        `On ${day} this crossing was still an external ${chosen.stay.mode ?? 'land'} border, so the day does not count.`,
    }
  }

  // 2. Does a permit exempt this person in this place?
  if (permit) {
    const scope = permit.scopeTerritoryIds
    const inScope = !scope || scope.length === 0 || scope.includes(territory.id)
    if (permit.exemptsFromAllowance && inScope) {
      return {
        ...base,
        charged: false,
        verdict: 'not_counted',
        reason: `Exempt: ${permit.label}.`,
      }
    }
  }

  // 3. How is this kind of presence charged?
  const kind = chosen.stay.presenceKind ?? DEFAULT_PRESENCE_KIND
  const rule = presenceRuleByKind(snapshot, kind)
  const precedent = precedentForKind(snapshot, kind, day)

  if (precedent) {
    precedent.sources.forEach((s) => base.sourceIds.push(s.id))
    precedent.sources.forEach((s) => base.sourceRefs.push(s))
    return {
      ...base,
      charged: precedent.counted,
      verdict: precedent.counted ? 'counts' : 'not_counted',
      byPrecedent: true,
      reason: `${precedent.label} — ruled by ${precedent.decidedBy ?? 'a person'} on ${precedent.window.from}.`,
    }
  }

  if (!rule) {
    return {
      ...base,
      charged: false,
      verdict: 'unresolved',
      disputed: true,
      alternative: 'counts',
      reason: `No presence rule covers "${kind}", so this day was not decided.`,
    }
  }

  rule.sources.forEach((s) => base.sourceIds.push(s.id))
  rule.sources.forEach((s) => base.sourceRefs.push(s))

  if (rule.disputed) {
    // Sources genuinely conflict. Do not pick a side silently: report the day as
    // unsettled and show what the count would be either way.
    return {
      ...base,
      charged: false,
      verdict: 'unresolved',
      disputed: true,
      alternative: rule.counted ? 'counts' : 'not_counted',
      reason: `${rule.label} — sources disagree. Needs a ruling before this day can be charged.`,
    }
  }

  return {
    ...base,
    charged: rule.counted,
    verdict: rule.counted ? 'counts' : 'not_counted',
    reason: rule.rationale ?? rule.label,
  }
}

function attribute(
  ledger: DayClassification[],
  breachDate: IsoDate,
  windowDays: number,
  daysUsed: number,
  limit: number,
): NonNullable<EngineVerdict['attribution']> {
  const start = toEpochDay(breachDate) - (windowDays - 1)
  const inWindow = ledger.filter(
    (d) => d.charged && toEpochDay(d.date) >= start && toEpochDay(d.date) <= toEpochDay(breachDate),
  )

  // The days that pushed the count past the limit are the most recent ones.
  const excessCount = daysUsed - limit
  const excess = inWindow.slice(Math.max(0, inWindow.length - excessCount))

  const byTrip = new Map<string, {tripId: string | null; tripLabel: string | null; days: IsoDate[]}>()
  for (const day of excess) {
    const key = day.tripId ?? '__none__'
    const bucket = byTrip.get(key) ?? {tripId: day.tripId, tripLabel: day.tripLabel, days: []}
    bucket.days.push(day.date)
    byTrip.set(key, bucket)
  }

  return {
    date: breachDate,
    count: daysUsed,
    blame: [...byTrip.values()],
  }
}

/**
 * Walk forward from the end of the recorded history and find the last day on
 * which presence is still permissible.
 *
 * Returns `null` when presence is permissible indefinitely — the window has
 * drained and nothing further is planned. Charges a day only if it would really
 * be charged, so a run of planned airside transits never eats the allowance.
 */
function computeLastPermissibleDay(
  snapshot: RuleSnapshot,
  resolved: ResolvedStay[],
  asOf: IsoDate,
  allowance: {countingBasis: 'arrival_inclusive' | 'any_touch' | 'departure_inclusive'},
  permit: PermitExemptionSnapshot | undefined,
  chargedDays: IsoDate[],
  limit: number,
  windowDays: number,
  warnings: string[],
): IsoDate | null {
  const charged = new Set(chargedDays)
  const lastPlanned = resolved.reduce(
    (max, r) => (r.toExclusive > max ? r.toExclusive : max),
    asOf,
  )

  // Long enough for the window to drain fully even if nothing is planned.
  const horizon = windowDays + 30
  // The walk starts where the traveller stands today, not at the end of their
  // itinerary — starting later would step straight over a breach.
  let cursor = asOf

  for (let step = 0; step < horizon; step += 1) {
    cursor = addDays(cursor, 1)
    const windowStart = addDays(cursor, -(windowDays - 1))

    for (const d of [...charged]) {
      if (d < windowStart) charged.delete(d)
    }

    const covering = resolved.find((r) => r.from <= cursor && cursor < r.toExclusive)
    if (covering) {
      const entry = classifyDay(snapshot, covering, cursor, allowance, permit, warnings)
      if (entry.charged) charged.add(cursor)
    }

    let count = 0
    for (const d of charged) {
      if (d >= windowStart && d <= cursor) count += 1
    }

    if (count > limit) return addDays(cursor, -1)

    // Nothing left to plan and nothing left in the window: presence is open-ended.
    if (cursor >= lastPlanned && charged.size === 0) return null
  }

  return cursor
}

function computeRepair(
  ledger: DayClassification[],
  attribution: EngineVerdict['attribution'],
  limit: number,
  countingBasis: 'arrival_inclusive' | 'any_touch' | 'departure_inclusive',
): NonNullable<EngineVerdict['repair']> {
  if (!attribution) {
    return {kind: 'none', daysToRemove: 0, instruction: 'You are inside the limit. Nothing to fix.'}
  }

  const excessCount = attribution.count - limit
  const excessDays = attribution.blame.flatMap((b) => b.days).sort()

  const firstExcess = excessDays[0]
  const stay = ledger.find((d) => d.date === firstExcess)
  if (!stay || !stay.territoryName) {
    return {
      kind: 'unresolved',
      daysToRemove: excessCount,
      instruction: `Remove ${excessCount} day(s) of presence to get back under ${limit}.`,
    }
  }

  const currentDeparture = ledger
    .filter((d) => d.tripId === stay.tripId && d.territoryCode === stay.territoryCode)
    .reduce((max, d) => (d.date > max ? d.date : max), firstExcess)

  // Under the Schengen convention the day of departure is not charged, so
  // leaving *on* the first excess day already removes it. When both edge days
  // count, the departure has to be the day before.
  const removesOnDepartureDay = countingBasis === 'arrival_inclusive'
  const suggested = removesOnDepartureDay ? firstExcess : addDays(firstExcess, -1)

  return {
    kind: 'shorten_stay',
    daysToRemove: excessCount,
    instruction:
      `You crossed the limit on ${attribution.date}. Leaving ${stay.territoryName} on ` +
      `${suggested}, rather than staying through ${currentDeparture}, brings you back to ` +
      `${limit} or fewer.`,
    stay: {
      territoryCode: stay.territoryCode ?? '',
      territoryName: stay.territoryName,
      arrive: stay.date,
      depart: currentDeparture,
    },
    suggestedDeparture: suggested,
  }
}

function refuse(
  itinerary: ItineraryInput,
  asOf: IsoDate,
  code: string,
  message: string,
): EngineVerdict {
  return {
    ok: false,
    refusal: {code, message},
    holder: itinerary.holder,
    allowance: null,
    limitDays: 0,
    windowDays: 0,
    used: 0,
    remaining: 0,
    unresolvedDays: [],
    ledger: [],
    repair: null,
    warnings: [message],
  }
}
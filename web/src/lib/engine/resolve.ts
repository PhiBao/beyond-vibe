/**
 * Rule resolution: for a given date and traveller, which rule actually applies?
 *
 * This is the part of the product that justifies itself. Answering it means
 * intersecting four independently time-varying datasets — territory access bands,
 * visa regimes, presence rules and human precedents — at a single calendar day.
 * The answer to "was this day charged?" is not present in any one document; it
 * only exists as the result of the join.
 */

import type {
  AccessBandSnapshot,
  IsoDate,
  NationalityClassSnapshot,
  PrecedentSnapshot,
  PresenceRuleSnapshot,
  RuleSnapshot,
  TerritorySnapshot,
  VisaRegimeSnapshot,
  WindowSnapshot,
} from './types'
import {toEpochDay} from './dates'

/** Half-open interval containment: [from, to). */
export function windowContains(window: WindowSnapshot | null | undefined, date: IsoDate): boolean {
  if (!window?.from) return false
  const d = toEpochDay(date)
  if (d < toEpochDay(window.from)) return false
  if (window.to && d >= toEpochDay(window.to)) return false
  return true
}

export interface BandMatch {
  band: AccessBandSnapshot
  /**
   * False when a band is in force on this date but only for some arrival modes,
   * and `mode` is not one of them. This is the Bulgaria and Romania case: land
   * and sea crossings were internal from 31 December 2024 while air borders were
   * still external until 31 March 2025. Falling back to `band.counted` there
   * would silently charge days for an air arrival that was not yet in the area.
   */
  modeApplies: boolean
}

/** Pick the band in force on `date`, honouring which modes of arrival it covers. */
export function bandFor(
  bands: AccessBandSnapshot[],
  date: IsoDate,
  mode?: string | null,
): BandMatch | undefined {
  const candidates = bands.filter((band) => windowContains(band.window, date))
  if (candidates.length === 0) return undefined

  if (mode) {
    const modeMatch = candidates.find((band) => band.modes?.includes(mode))
    if (modeMatch) return {band: modeMatch, modeApplies: true}
  }

  // A band that scopes itself to specific modes does not govern other modes.
  const scoped = candidates.find((band) => Array.isArray(band.modes) && band.modes.length > 0)
  if (scoped) return {band: scoped, modeApplies: false}

  return {band: candidates[0], modeApplies: true}
}

export function territoryByCode(snapshot: RuleSnapshot, code: string): TerritorySnapshot | undefined {
  return snapshot.territories.find((t) => t.code === code)
}

export function classForPassport(
  snapshot: RuleSnapshot,
  passport: string,
): NationalityClassSnapshot | undefined {
  const code = passport.toUpperCase()
  return snapshot.nationalityClasses.find((cls) =>
    cls.passports.some((p) => p.toUpperCase() === code),
  )
}

export function regimeFor(
  snapshot: RuleSnapshot,
  classId: string,
  allowanceId: string,
  date: IsoDate,
): VisaRegimeSnapshot | undefined {
  return snapshot.visaRegimes.find(
    (r) =>
      r.nationalityClassId === classId &&
      r.allowanceId === allowanceId &&
      windowContains(r.window, date),
  )
}

export function presenceRuleByKind(
  snapshot: RuleSnapshot,
  kind: string | null | undefined,
): PresenceRuleSnapshot | undefined {
  if (!kind) return undefined
  return snapshot.presenceRules.find((r) => r.kind === kind)
}

/**
 * The most recent active, in-force human precedent for a presence kind.
 *
 * Later rulings win; a superseded ruling is never returned. This is the whole
 * point of the product: the corpus of decisions improves the next calculation.
 */
export function precedentForKind(
  snapshot: RuleSnapshot,
  kind: string,
  date: IsoDate,
): PrecedentSnapshot | undefined {
  const candidates = snapshot.precedents
    .filter((p) => p.status === 'active')
    .filter((p) => p.subjectKind === 'presence_kind' && p.presenceKind === kind)
    .filter((p) => windowContains(p.window, date))
    .sort((a, b) => toEpochDay(b.window.from) - toEpochDay(a.window.from))

  return candidates[0]
}

/**
 * Does the permit exempt its holder from this counter, for this territory?
 *
 * A pending residence application is the classic trap: it exists, it is real,
 * and it very often does *not* exempt you. Absent facts and permissive facts are
 * therefore kept strictly apart.
 */
export function permitExemptsTerritory(
  snapshot: RuleSnapshot,
  permitId: string | null | undefined,
  territoryId: string,
  allowanceId: string,
): {exempt: boolean; exemptionId?: string} {
  if (!permitId) return {exempt: false}
  const exemption = snapshot.permitExemptions.find((e) => e.id === permitId)
  if (!exemption) return {exempt: false}
  if (!exemption.exemptsFromAllowance) return {exempt: false, exemptionId: exemption.id}

  const scope = exemption.scopeTerritoryIds
  if (scope && scope.length > 0 && !scope.includes(territoryId)) {
    return {exempt: false, exemptionId: exemption.id}
  }

  return {exempt: true, exemptionId: exemption.id}
}
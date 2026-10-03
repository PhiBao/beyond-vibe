/**
 * Builds an engine snapshot directly from the authored dataset.
 *
 * Two consumers use this: the test suite, and a local fallback when the Sanity
 * dataset is unreachable. The web app prefers live Sanity data — see
 * `web/src/lib/sanity/snapshot.ts` — but both paths must agree, which is why
 * both key off `docId`.
 */

import {
  ALLOWANCES,
  PERMIT_EXEMPTIONS,
  PRECEDENTS,
  PRESENCE_RULES,
  SOURCES,
  TERRITORIES,
  VISA_REGIMES,
  NATIONALITY_CLASSES,
} from './dataset'
import {docId} from './ids'
import type {
  AllowanceSnapshot,
  NationalityClassSnapshot,
  PermitExemptionSnapshot,
  PrecedentSnapshot,
  PresenceRuleSnapshot,
  RuleSnapshot,
  SourceSnapshot,
  TerritorySnapshot,
  VisaRegimeSnapshot,
} from '../engine/types'

const SCHENGEN = docId('allowance', 'schengen-short-stay')

function sources(...keys: string[]): SourceSnapshot[] {
  return keys
    .map((k) => SOURCES.find((s) => s.key === k))
    .filter((s): s is (typeof SOURCES)[number] => Boolean(s))
    .map((s) => ({
      id: docId('source', s.key),
      title: s.title,
      publisher: s.publisher,
      url: s.url,
      kind: s.kind,
      retrievedAt: s.retrievedAt,
    }))
}

export function buildLocalSnapshot(): RuleSnapshot {
  const allowances: AllowanceSnapshot[] = ALLOWANCES.map((a) => ({
    id: docId('allowance', a.key),
    title: a.title,
    windowDays: a.windowDays,
    limitDays: a.limitDays,
    countingBasis: a.countingBasis,
    sources: sources(...a.sourceKeys),
  }))

  const territories: TerritorySnapshot[] = TERRITORIES.map((t) => ({
    id: docId('territory', t.key),
    name: t.name,
    code: t.code,
    kind: t.kind,
    allowances: [SCHENGEN],
    accessBands: t.accessBands.map((b) => ({
      window: {from: b.from, to: b.to ?? null, note: b.basis},
      counted: b.counted,
      modes: b.modes ?? null,
      basis: b.basis,
      sources: sources(...b.sourceKeys),
    })),
  }))

  const nationalityClasses: NationalityClassSnapshot[] = NATIONALITY_CLASSES.map((c) => ({
    id: docId('nationalityClass', c.key),
    label: c.label,
    passports: c.passports,
    defaultPermitKey: c.defaultPermitKey ?? null,
    sources: sources(...c.sourceKeys),
  }))

  const visaRegimes: VisaRegimeSnapshot[] = VISA_REGIMES.map((r) => ({
    id: docId('visaRegime', r.key),
    nationalityClassId: docId('nationalityClass', r.nationalityClassKey),
    allowanceId: SCHENGEN,
    window: {from: r.from, to: r.to ?? null, note: r.notes ?? null},
    visaRequired: r.visaRequired,
    maxDaysPerEntry: r.maxDaysPerEntry ?? null,
    sources: sources(...r.sourceKeys),
  }))

  const permitExemptions: PermitExemptionSnapshot[] = PERMIT_EXEMPTIONS.map((p) => ({
    id: docId('permitExemption', p.key),
    label: p.label,
    kind: p.kind,
    exemptsFromAllowance: p.exemptsFromAllowance,
    scopeTerritoryIds: p.scopeTerritoryKeys?.map((k) => docId('territory', k)) ?? null,
    conditions: p.conditions,
    sources: sources(...p.sourceKeys),
  }))

  const presenceRules: PresenceRuleSnapshot[] = PRESENCE_RULES.map((p) => ({
    id: docId('presenceRule', p.key),
    label: p.label,
    kind: p.kind,
    counted: p.counted,
    disputed: p.disputed,
    rationale: p.rationale,
    sources: sources(...p.sourceKeys),
  }))

  const precedents: PrecedentSnapshot[] = PRECEDENTS.map((p) => ({
    id: docId('precedent', p.key),
    key: p.key,
    label: p.label,
    subjectKind: p.subjectKind,
    presenceKind: p.presenceKind ?? null,
    counted: p.counted,
    rationale: p.rationale,
    window: {from: p.from, to: null, note: null},
    decidedBy: p.decidedBy,
    decidedAt: `${p.from}T00:00:00Z`,
    scope: p.scope,
    status: 'active',
    sources: sources(...p.sourceKeys),
  }))

  return {
    allowances,
    territories,
    nationalityClasses,
    visaRegimes,
    permitExemptions,
    presenceRules,
    precedents,
  }
}

let cached: RuleSnapshot | null = null

export function localSnapshot(): RuleSnapshot {
  if (!cached) cached = buildLocalSnapshot()
  return cached
}

/** Sanity document ID for the seeded allowance, handy in queries. */
export const SCHENGEN_ALLOWANCE_ID = SCHENGEN
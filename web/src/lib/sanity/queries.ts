import {defineQuery} from 'next-sanity'

/**
 * GROQ gotcha this file exists to avoid: a projection must open *immediately*
 * after the `]` of its filter. Whitespace there — including a newline — makes
 * GROQ read the following braces as a block instead, and the query fails to
 * parse. The queries below are therefore formatted with `[...]{...}` and no gap.
 */

const SRC = `{"id": _id, title, publisher, url, kind, notes, retrievedAt, locator, quote, stance}`

/**
 * One query fetches the whole rule corpus and resolves every reference in the
 * same pass, so the browser receives a flat snapshot the engine consumes
 * directly. Nested projections do the joining, which is why the engine never
 * has to make its own database calls.
 */
export const RULE_SNAPSHOT_QUERY = defineQuery(`{
  "allowances": *[_type == "allowance"]{"id": _id, title, windowDays, limitDays, countingBasis, "sources": sources[]->${SRC}},
  "territories": *[_type == "territory"]{"id": _id, name, code, kind, "allowances": allowances[]->_id, "accessBands": accessBands[]{"window": {"from": window.from, "to": window.to, "note": window.note}, counted, modes, basis, "sources": sources[]->${SRC}}},
  "nationalityClasses": *[_type == "nationalityClass"]{"id": _id, label, summary, passports, defaultPermitKey, "sources": sources[]->${SRC}},
  "visaRegimes": *[_type == "visaRegime"]{"id": _id, "nationalityClassId": nationalityClass->_id, "allowanceId": allowance->_id, "window": {"from": window.from, "to": window.to, "note": window.note}, visaRequired, maxDaysPerEntry, "sources": sources[]->${SRC}},
  "permitExemptions": *[_type == "permitExemption"]{"id": _id, label, kind, exemptsFromAllowance, "scopeTerritoryIds": scopeTerritories[]->_id, conditions, "sources": sources[]->${SRC}},
  "presenceRules": *[_type == "presenceRule"]{"id": _id, label, kind, counted, disputed, rationale, "sources": sources[]->${SRC}},
  "precedents": *[_type == "precedent"]{"id": _id, key, label, subjectKind, presenceKind, counted, rationale, "window": {"from": window.from, "to": window.to, "note": window.note}, decidedBy, decidedAt, scope, status, "sources": sources[]->${SRC}}
}`)

export const DEMO_ITINERARIES_QUERY = defineQuery(`
*[_type == "itinerary" && demo == true] | order(title asc){
  "id": _id,
  title,
  "slug": slug.current,
  summary,
  holder{passport, label, "nationalityClassId": nationalityClass->_id, "permitExemptionId": permit->_id},
  "allowanceId": allowance->_id,
  "trips": *[_type == "trip" && references(^._id)] | order(label asc){
    "id": _id,
    label,
    "stays": stays[]{"territoryCode": territory->code, "territoryName": territory->name, arrive, depart, "presenceKind": presenceRule->kind, "presenceLabel": presenceRule->label, mode, note}
  }
}`)

export const DISPUTES_QUERY = defineQuery(`
*[_type == "dispute"] | order(_createdAt desc){
  "id": _id,
  question,
  subjectKind,
  status,
  "presenceKind": presenceRule->kind,
  "presenceRuleLabel": presenceRule->label,
  "territoryName": territory->name,
  "itineraryId": itinerary->_id,
  "itineraryTitle": itinerary->title,
  "competingClaims": competingClaims[]{claim, outcome, "sources": sources[]->{"id": _id, title, publisher, url, retrievedAt, locator}},
  ruling
}`)
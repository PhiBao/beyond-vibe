// Must be first: loads .env.local before the Sanity client reads it.
import './load-env'

/**
 * Seeds the authored dataset into Sanity.
 *
 * Documents are written under deterministic IDs derived from `docId`, so running
 * this repeatedly updates in place instead of duplicating the corpus. That
 * deviation from "let Sanity generate IDs" is deliberate: the reference data is
 * effectively a singleton set (one document per territory, one per allowance),
 * and idempotent re-seeding is worth more here than generated IDs.
 *
 * Usage:  pnpm seed            (anchors demo dates to today)
 *         DEMO_ANCHOR=2026-10-01 pnpm seed
 */

import {
  ALLOWANCES,
  NATIONALITY_CLASSES,
  PERMIT_EXEMPTIONS,
  PRECEDENTS,
  PRESENCE_RULES,
  SOURCES,
  TERRITORIES,
  VISA_REGIMES,
} from '../src/lib/data/dataset'
import {docId} from '../src/lib/data/ids'
import {writeClient} from '../src/lib/sanity/client'
import {addDays, toEpochDay} from '../src/lib/engine/dates'

const ANCHOR = process.env.DEMO_ANCHOR ?? new Date().toISOString().slice(0, 10)

/** A calendar date `n` days before the anchor. */
const before = (n: number) => addDays(ANCHOR, -n)
/** A calendar date `n` days after the anchor. */
const after = (n: number) => addDays(ANCHOR, n)

const ref = (type: Parameters<typeof docId>[0], key: string) => ({
  _type: 'reference' as const,
  _ref: docId(type, key),
})

const sourceRefs = (keys: string[]) => keys.map((k) => ({_type: 'sourceRef', _ref: docId('source', k), _key: k}))

async function main() {
  const client = writeClient()
  const created: string[] = []
  const updated: string[] = []

  async function upsert(doc: Record<string, unknown>) {
    const id = doc._id as string
    exists.add(id)
    const found = await client.fetch<boolean>(`*[_id == $id][0]._id`, {id})
    await client.createOrReplace(doc as never)
    ;(found ? updated : created).push(`${doc._type}: ${(doc as {name?: string; title?: string; label?: string}).name ?? (doc as {title?: string}).title ?? (doc as {label?: string}).label ?? id}`)
  }

  // Every document ID this seed owns. Anything else carrying our prefix is left
  // over from an earlier run and is removed below, so re-seeding converges
  // instead of accumulating.
  const exists = new Set<string>()

  // --- Sources -------------------------------------------------------------
  for (const s of SOURCES) {
    await upsert({
      _id: docId('source', s.key),
      _type: 'source',
      title: s.title,
      publisher: s.publisher,
      url: s.url,
      kind: s.kind,
      retrievedAt: s.retrievedAt,
      notes: s.notes ?? null,
    })
  }

  // --- Allowance -----------------------------------------------------------
  for (const a of ALLOWANCES) {
    await upsert({
      _id: docId('allowance', a.key),
      _type: 'allowance',
      title: a.title,
      code: {_type: 'slug', current: a.key},
      windowDays: a.windowDays,
      limitDays: a.limitDays,
      countingBasis: a.countingBasis,
      consequences: a.consequences,
      sources: sourceRefs(a.sourceKeys),
    })
  }

  // --- Territories ---------------------------------------------------------
  for (const t of TERRITORIES) {
    await upsert({
      _id: docId('territory', t.key),
      _type: 'territory',
      name: t.name,
      code: t.code,
      kind: t.kind,
      carveOutOf: t.carveOutOf ? ref('territory', t.carveOutOf) : undefined,
      allowances: [ref('allowance', 'schengen-short-stay')],
      accessBands: t.accessBands.map((b, i) => ({
        _key: `${t.key}-${i}`,
        _type: 'accessBand',
        window: {_type: 'effectiveWindow', from: b.from, to: b.to ?? null, note: b.basis},
        counted: b.counted,
        modes: b.modes ?? null,
        basis: b.basis,
        sources: sourceRefs(b.sourceKeys),
      })),
    })
  }

  // --- Nationality classes -------------------------------------------------
  for (const c of NATIONALITY_CLASSES) {
    await upsert({
      _id: docId('nationalityClass', c.key),
      _type: 'nationalityClass',
      label: c.label,
      code: {_type: 'slug', current: c.key},
      passports: c.passports,
      summary: c.summary,
      defaultPermitKey: c.defaultPermitKey ?? null,
      sources: sourceRefs(c.sourceKeys),
    })
  }

  // --- Visa regimes --------------------------------------------------------
  for (const r of VISA_REGIMES) {
    await upsert({
      _id: docId('visaRegime', r.key),
      _type: 'visaRegime',
      nationalityClass: ref('nationalityClass', r.nationalityClassKey),
      allowance: ref('allowance', 'schengen-short-stay'),
      window: {_type: 'effectiveWindow', from: r.from, to: r.to ?? null, note: r.notes ?? null},
      visaRequired: r.visaRequired,
      maxDaysPerEntry: r.maxDaysPerEntry ?? null,
      allowedPurposes: r.allowedPurposes ?? null,
      notes: r.notes ?? null,
      sources: sourceRefs(r.sourceKeys),
    })
  }

  // --- Permit exemptions ---------------------------------------------------
  for (const p of PERMIT_EXEMPTIONS) {
    await upsert({
      _id: docId('permitExemption', p.key),
      _type: 'permitExemption',
      label: p.label,
      kind: p.kind,
      exemptsFromAllowance: p.exemptsFromAllowance,
      scopeTerritories: p.scopeTerritoryKeys?.map((k) => ref('territory', k)) ?? null,
      conditions: p.conditions,
      sources: sourceRefs(p.sourceKeys),
    })
  }

  // --- Presence rules ------------------------------------------------------
  for (const p of PRESENCE_RULES) {
    await upsert({
      _id: docId('presenceRule', p.key),
      _type: 'presenceRule',
      label: p.label,
      code: {_type: 'slug', current: p.key},
      kind: p.kind,
      counted: p.counted,
      disputed: p.disputed,
      rationale: p.rationale,
      sources: sourceRefs(p.sourceKeys),
    })
  }

  // --- Precedent -----------------------------------------------------------
  for (const p of PRECEDENTS) {
    await upsert({
      _id: docId('precedent', p.key),
      _type: 'precedent',
      key: p.key,
      label: p.label,
      subjectKind: p.subjectKind,
      presenceKind: p.presenceKind ?? null,
      counted: p.counted,
      rationale: p.rationale,
      window: {_type: 'effectiveWindow', from: p.from, to: null, note: null},
      decidedBy: p.decidedBy,
      decidedAt: `${p.from}T00:00:00Z`,
      scope: p.scope,
      status: 'active',
      sources: sourceRefs(p.sourceKeys),
    })
  }

  // --- Demo itineraries ----------------------------------------------------
  // Demo 1: the headline. Legal today, with a booked trip that is not. The
  // numbers are shaped by `pnpm shape:demo` rather than hand-guessed.
  const demoATrips = [
    {key: 'lisbon', label: 'Lisbon', territory: 'pt', arrive: '2026-03-12', depart: '2026-03-26', mode: 'air'},
    {key: 'seville', label: 'Seville day trip', territory: 'es', arrive: '2026-04-06', depart: '2026-04-10', mode: 'land'},
    {key: 'canaries', label: 'Canary Islands', territory: 'es-canary', arrive: '2026-04-14', depart: '2026-04-26', mode: 'air', note: 'Outside the area — Spanish territory, but not in it'},
    {key: 'dublin', label: 'Dublin', territory: 'ie', arrive: '2026-04-30', depart: '2026-05-08', mode: 'air', note: 'Outside the area'},
    {key: 'prague', label: 'Prague', territory: 'cz', arrive: '2026-05-14', depart: '2026-05-29', mode: 'land'},
    {key: 'vienna-spring', label: 'Vienna', territory: 'at', arrive: '2026-06-05', depart: '2026-06-19', mode: 'land'},
    {key: 'amsterdam', label: 'Amsterdam', territory: 'nl', arrive: '2026-06-26', depart: '2026-07-14', mode: 'land'},
    {key: 'stockholm', label: 'Stockholm', territory: 'se', arrive: '2026-07-18', depart: '2026-07-30', mode: 'air'},
    {key: 'como', label: 'Lake Como', territory: 'it', arrive: '2026-08-06', depart: '2026-08-17', mode: 'land'},
    {
      key: 'paris-layover',
      label: 'Paris layover',
      territory: 'fr',
      arrive: '2026-09-10',
      depart: '2026-09-11',
      mode: 'air',
      presenceRule: 'airport-transit-landside',
      note: 'Cleared immigration, re-departed from the same airport',
    },
    {key: 'barcelona', label: 'Barcelona — booked', territory: 'es', arrive: '2026-10-06', depart: '2026-10-28', mode: 'air'},
  ]

  const demoAId = docId('itinerary', 'the-year-in-europe')
  await upsert({
    _id: demoAId,
    _type: 'itinerary',
    title: 'The year in Europe',
    slug: {_type: 'slug', current: 'the-year-in-europe'},
    holder: {passport: 'US', label: 'Sam', nationalityClass: ref('nationalityClass', 'visa-free-90-180')},
    allowance: ref('allowance', 'schengen-short-stay'),
    summary: 'A year of hops, including two that quietly do not count.',
    demo: true,
  })

  for (const t of demoATrips) {
    await upsert({
      _id: docId('trip', t.key),
      _type: 'trip',
      label: t.label,
      itinerary: ref('itinerary', 'the-year-in-europe'),
      stays: [
        {
          _key: `${t.key}-0`,
          _type: 'stay',
          territory: ref('territory', t.territory),
          arrive: t.arrive,
          depart: t.depart,
          mode: t.mode,
          note: t.note ?? null,
          presenceRule: t.presenceRule
            ? ref('presenceRule', t.presenceRule)
            : ref('presenceRule', 'cleared-entry'),
        },
      ],
    })
  }

  // Demo 2: a genuinely contested day, before the precedent takes effect.
  const demoBId = docId('itinerary', 'the-disputed-layover')
  await upsert({
    _id: demoBId,
    _type: 'itinerary',
    title: 'The disputed layover',
    slug: {_type: 'slug', current: 'the-disputed-layover'},
    holder: {passport: 'IN', label: 'Priya', nationalityClass: ref('nationalityClass', 'visa-required')},
    allowance: ref('allowance', 'schengen-short-stay'),
    summary: 'One layover, two official answers. Ninety will not pick a side for you.',
    demo: true,
  })

  for (const [key, label, arrive, depart, extra] of [
    ['layover-trip', 'Via Paris', before(400), before(370), ''],
    ['layover-transit', 'The layover itself', before(340), before(338), 'Cleared immigration, re-departed from the same airport'],
  ] as const) {
    await upsert({
      _id: docId('trip', key),
      _type: 'trip',
      label,
      itinerary: ref('itinerary', 'the-disputed-layover'),
      stays: [
        {
          _key: `${key}-0`,
          _type: 'stay',
          territory: ref('territory', 'fr'),
          arrive,
          depart,
          mode: 'air',
          note: extra || null,
          presenceRule:
            key === 'layover-transit'
              ? ref('presenceRule', 'airport-transit-landside')
              : ref('presenceRule', 'cleared-entry'),
        },
      ],
    })
  }

  // --- The open dispute behind demo 2 -------------------------------------
  const disputeId = docId('dispute', 'cleared-layover-counts')
  await upsert({
    _id: disputeId,
    _type: 'dispute',
    question: 'Does a layover that clears border control count as a day in the area?',
    subjectKind: 'presence_kind',
    presenceRule: ref('presenceRule', 'airport-transit-landside'),
    itinerary: ref('itinerary', 'the-disputed-layover'),
    status: 'open',
    competingClaims: [
      {
        _key: 'claim-1',
        _type: 'competingClaim',
        claim: 'Admission at the border is entry into the territory, so the day counts.',
        outcome: true,
        sources: sourceRefs(['ec-border-crossing']),
      },
      {
        _key: 'claim-2',
        _type: 'competingClaim',
        claim: 'The rule is framed around "staying" in the area; a same-day transit is not a stay.',
        outcome: false,
        sources: sourceRefs(['ec-visa-policy']),
      },
    ],
  })

  // --- Report --------------------------------------------------------------
  // Prune leftovers so the dataset converges on the authored corpus rather than
  // accumulating stale documents on every run.
  // A top-level `._id` projection yields plain strings, not objects.
  const tripAndItineraryIds = await client.fetch<string[]>(
    `*[_type == "trip" || _type == "itinerary"]._id`,
  )
  const stale = (tripAndItineraryIds ?? []).filter(
    (id) => typeof id === 'string' && id.startsWith('ninety.') && !exists.has(id),
  )

  let removed = 0
  for (const id of stale) {
    try {
      // @sanity/client v8 takes a bare document ID or a {query} object;
      // the older {id} selection shape is rejected.
      await client.delete(id)
      removed += 1
    } catch (error) {
      console.warn(`  could not delete ${id}: ${(error as Error).message}`)
    }
  }

  console.log(`Seeded with anchor ${ANCHOR} (${toEpochDay(ANCHOR)} epoch days)`)
  console.log(`  created: ${created.length}`)
  console.log(`  updated: ${updated.length}`)
  console.log(`  removed stale: ${removed}`)
  console.log(`\nItineraries available in the demo:`)

  const itineraries = await client.fetch<Array<{title: string; slug: {current: string}}>>(
    `*[_type == "itinerary" && demo == true]{title, "slug": slug.current}`,
  )
  for (const i of itineraries) console.log(`  - ${i.title} (${i.slug})`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
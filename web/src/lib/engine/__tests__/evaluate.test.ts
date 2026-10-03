import {describe, expect, it} from 'vitest'
import {evaluate} from '../evaluate'
import {localSnapshot} from '@/lib/data/snapshot'
import type {ItineraryInput, RuleSnapshot} from '../types'

const snap = (): RuleSnapshot => structuredClone(localSnapshot())

/** A visa-free US passport holder, the simplest possible subject. */
function traveller(trips: ItineraryInput['trips'], overrides: Partial<ItineraryInput['holder']> = {}) {
  return {
    holder: {passport: 'US', ...overrides},
    trips,
  }
}

const stay = (
  tripId: string,
  tripLabel: string,
  territoryCode: string,
  arrive: string,
  depart: string,
  extra: Partial<ItineraryInput['trips'][number]['stays'][number]> = {},
) => ({tripId, tripLabel, territoryCode, arrive, depart, mode: 'land', ...extra})

describe('counting conventions', () => {
  it('counts the day of arrival and not the day of departure', () => {
    const v = evaluate(
      snap(),
      traveller([{id: 't1', label: 'Paris', stays: [stay('t1', 'Paris', 'FR', '2026-01-05', '2026-01-15')]}]),
      {asOf: '2026-01-20'},
    )
    // 5 Jan through 14 Jan inclusive = 10 days.
    expect(v.used).toBe(10)
    expect(v.remaining).toBe(80)
  })

  it('counts a same-day visit as one day', () => {
    const v = evaluate(
      snap(),
      traveller([{id: 't1', label: 'Day trip', stays: [stay('t1', 'Day trip', 'FR', '2026-01-05', '2026-01-05')]}]),
      {asOf: '2026-01-06'},
    )
    expect(v.used).toBe(1)
  })
})

describe('the rolling window', () => {
  it('ages days out of the window so old trips stop counting', () => {
    const v = evaluate(
      snap(),
      traveller([
        {id: 'old', label: 'Ancient history', stays: [stay('old', 'Ancient history', 'FR', '2024-01-10', '2024-02-10')]},
      ]),
      {asOf: '2026-06-01'},
    )
    // 31 days, but every one of them is more than 180 days before 1 June 2026.
    expect(v.used).toBe(0)
  })

  it('counts days across several trips inside one window', () => {
    const v = evaluate(
      snap(),
      traveller([
        {id: 'a', label: 'A', stays: [stay('a', 'A', 'FR', '2026-01-10', '2026-02-10')]},
        {id: 'b', label: 'B', stays: [stay('b', 'B', 'DE', '2026-03-01', '2026-04-15')]},
      ]),
      {asOf: '2026-04-14'},
    )
    // 31 + 45 = 76
    expect(v.used).toBe(76)
  })
})

describe('crossing-date attribution', () => {
  const nearlyOver = () =>
    traveller([
      {id: 'a', label: 'Spring in Paris', stays: [stay('a', 'Spring in Paris', 'FR', '2026-01-10', '2026-02-10')]},
      {id: 'b', label: 'Rome and Berlin', stays: [stay('b', 'Rome and Berlin', 'IT', '2026-03-01', '2026-04-15')]},
      {id: 'c', label: 'Lisbon', stays: [stay('c', 'Lisbon', 'PT', '2026-05-01', '2026-05-20')]},
    ])

  it('identifies the exact day the limit was exceeded', () => {
    const v = evaluate(snap(), nearlyOver(), {asOf: '2026-05-19'})

    // 31 (Jan10–Feb9) + 45 (Mar1–Apr14) = 76 before May.
    // May 1–14 brings it to exactly 90. May 15 is the 91st.
    expect(v.attribution?.date).toBe('2026-05-15')
    expect(v.attribution?.count).toBe(91)
  })

  it('names the trip responsible for the excess day', () => {
    const v = evaluate(snap(), nearlyOver(), {asOf: '2026-05-19'})
    expect(v.attribution?.blame).toHaveLength(1)
    expect(v.attribution?.blame[0].tripId).toBe('c')
    expect(v.attribution?.blame[0].days).toEqual(['2026-05-15'])
  })

  it('proposes a fix that actually restores compliance', () => {
    const v = evaluate(snap(), nearlyOver(), {asOf: '2026-05-19'})

    expect(v.repair?.kind).toBe('shorten_stay')
    expect(v.repair?.daysToRemove).toBe(1)
    expect(v.repair?.suggestedDeparture).toBe('2026-05-15')

    // Re-run with the proposed change and confirm the breach disappears.
    const fixed = evaluate(
      snap(),
      traveller([
        {id: 'a', label: 'Spring in Paris', stays: [stay('a', 'Spring in Paris', 'FR', '2026-01-10', '2026-02-10')]},
        {id: 'b', label: 'Rome and Berlin', stays: [stay('b', 'Rome and Berlin', 'IT', '2026-03-01', '2026-04-15')]},
        {id: 'c', label: 'Lisbon', stays: [stay('c', 'Lisbon', 'PT', '2026-05-01', '2026-05-15')]},
      ]),
      {asOf: '2026-05-19'},
    )
    expect(fixed.attribution).toBeNull()
    expect(fixed.used).toBe(90)
    expect(fixed.repair?.kind).toBe('none')
  })

  it('reports no breach when the traveller is inside the limit', () => {
    const v = evaluate(
      snap(),
      traveller([{id: 'a', label: 'Short', stays: [stay('a', 'Short', 'FR', '2026-01-10', '2026-01-20')]}]),
      {asOf: '2026-01-25'},
    )
    expect(v.attribution).toBeNull()
    expect(v.repair?.kind).toBe('none')
  })
})

describe('territories outside the area', () => {
  it('never charges days spent in the United Kingdom', () => {
    const v = evaluate(
      snap(),
      traveller([{id: 'uk', label: 'London', stays: [stay('uk', 'London', 'GB', '2026-01-05', '2026-01-25')]}]),
      {asOf: '2026-01-25'},
    )
    expect(v.used).toBe(0)
  })

  it('never charges days in an in-state carve-out', () => {
    const v = evaluate(
      snap(),
      traveller([
        {id: 'can', label: 'Canaries', stays: [stay('can', 'Canaries', 'XCI', '2026-02-01', '2026-02-15')]},
      ]),
      {asOf: '2026-02-15'},
    )
    expect(v.used).toBe(0)
    const day = v.ledger.find((d) => d.date === '2026-02-05')
    expect(day?.reason).toMatch(/outside the Schengen area/i)
  })

  it('counts mainland Spain while ignoring the Canary Islands', () => {
    const v = evaluate(
      snap(),
      traveller([
        {id: 'm', label: 'Madrid', stays: [stay('m', 'Madrid', 'ES', '2026-03-01', '2026-03-11')]},
        {id: 'c', label: 'Canaries', stays: [stay('c', 'Canaries', 'XCI', '2026-03-11', '2026-03-21')]},
      ]),
      {asOf: '2026-03-21'},
    )
    expect(v.used).toBe(10)
  })
})

describe('date-banded membership', () => {
  it('does not charge Bulgarian days before accession', () => {
    const v = evaluate(
      snap(),
      traveller([{id: 'bg', label: 'Sofia 2022', stays: [stay('bg', 'Sofia 2022', 'BG', '2022-06-01', '2022-06-15')]}]),
      {asOf: '2022-06-15'},
    )
    expect(v.used).toBe(0)
  })

  it('charges Bulgarian days after accession', () => {
    // Bulgaria joined on 31 December 2024, not in 2023 like Croatia.
    const v = evaluate(
      snap(),
      traveller([{id: 'bg', label: 'Sofia 2025', stays: [stay('bg', 'Sofia 2025', 'BG', '2025-06-01', '2025-06-15')]}]),
      {asOf: '2025-06-15'},
    )
    expect(v.used).toBe(14)
  })

  it('does not charge Bulgarian air arrivals before the air border opened', () => {
    const v = evaluate(
      snap(),
      traveller([
        {id: 'bg', label: 'Sofia by air', stays: [stay('bg', 'Sofia by air', 'BG', '2025-01-10', '2025-01-20', {mode: 'air'})]},
      ]),
      {asOf: '2025-01-20'},
    )
    expect(v.used).toBe(0)
  })

  it('respects the mode of arrival during the partial-access window', () => {
    // Between 31 Dec 2024 and 31 Mar 2025 only land and sea were internal.
    const byLand = evaluate(
      snap(),
      traveller([
        {id: 'bg', label: 'Ruse', stays: [stay('bg', 'Ruse', 'BG', '2025-02-01', '2025-02-11', {mode: 'land'})]},
      ]),
      {asOf: '2025-02-11'},
    )
    expect(byLand.used).toBe(10)

    const byAir = evaluate(
      snap(),
      traveller([
        {id: 'bg', label: 'Sofia flight', stays: [stay('bg', 'Sofia flight', 'BG', '2025-02-01', '2025-02-11', {mode: 'air'})]},
      ]),
      {asOf: '2025-02-11'},
    )
    expect(byAir.used).toBe(0)
  })

  it('charges Bulgarian air arrivals once the air border became internal', () => {
    const v = evaluate(
      snap(),
      traveller([
        {id: 'bg', label: 'Sofia flight', stays: [stay('bg', 'Sofia flight', 'BG', '2025-04-01', '2025-04-11', {mode: 'air'})]},
      ]),
      {asOf: '2025-04-11'},
    )
    expect(v.used).toBe(10)
  })

  it('splits Croatia across its accession date', () => {
    const v = evaluate(
      snap(),
      traveller([
        {id: 'hr', label: 'Split', stays: [stay('hr', 'Split', 'HR', '2022-06-01', '2022-07-01')]},
      ]),
      {asOf: '2022-07-01'},
    )
    expect(v.used).toBe(0)
  })
})

describe('how presence is charged', () => {
  it('never charges an airside airport transit', () => {
    const v = evaluate(
      snap(),
      traveller([
        {id: 'lay', label: 'Layover', stays: [stay('lay', 'Layover', 'FR', '2026-05-01', '2026-05-03', {presenceKind: 'airport_transit'})]},
      ]),
      {asOf: '2026-05-03'},
    )
    expect(v.used).toBe(0)
  })

  it('charges a cleared entry', () => {
    const v = evaluate(
      snap(),
      traveller([
        {id: 'p', label: 'Paris', stays: [stay('p', 'Paris', 'FR', '2026-05-01', '2026-05-03', {presenceKind: 'cleared_entry'})]},
      ]),
      {asOf: '2026-05-03'},
    )
    expect(v.used).toBe(2)
  })

  it('refuses to settle a disputed day without a human ruling', () => {
    // Before the seeded precedent takes effect, a landside transit is unresolved.
    const v = evaluate(
      snap(),
      traveller([
        {id: 'x', label: 'Transit', stays: [stay('x', 'Transit', 'FR', '2025-05-01', '2025-05-04', {presenceKind: 'airport_transit_landside'})]},
      ]),
      {asOf: '2025-05-04'},
    )
    expect(v.unresolvedDays).toEqual(['2025-05-01', '2025-05-02', '2025-05-03'])
    expect(v.used).toBe(0)
    expect(v.warnings.join(' ')).toContain('human ruling')
  })

  it('applies a human precedent to the same disputed day', () => {
    const v = evaluate(
      snap(),
      traveller([
        {id: 'x', label: 'Transit', stays: [stay('x', 'Transit', 'FR', '2026-05-01', '2026-05-04', {presenceKind: 'airport_transit_landside'})]},
      ]),
      {asOf: '2026-05-04'},
    )
    expect(v.unresolvedDays).toEqual([])
    expect(v.used).toBe(3)
    const day = v.ledger.find((d) => d.date === '2026-05-01')
    expect(day?.byPrecedent).toBe(true)
    expect(day?.reason).toContain('ruled by')
  })
})

describe('status and permits', () => {
  it('exempts a residence permit holder', () => {
    const v = evaluate(
      snap(),
      traveller([{id: 'p', label: 'Resident', stays: [stay('p', 'Resident', 'FR', '2026-01-01', '2026-02-01')]}], {
        permitExemptionId: 'residence-permit',
      }),
      {asOf: '2026-02-01'},
    )
    expect(v.used).toBe(0)
  })

  it('does not exempt someone whose application is still pending', () => {
    const v = evaluate(
      snap(),
      traveller([{id: 'p', label: 'Applicant', stays: [stay('p', 'Applicant', 'FR', '2026-01-01', '2026-02-01')]}], {
        permitExemptionId: 'pending-application',
      }),
      {asOf: '2026-02-01'},
    )
    expect(v.used).toBe(31)
  })

  it('applies free movement automatically to an EU passport', () => {
    const v = evaluate(
      snap(),
      traveller([{id: 'p', label: 'Berlin', stays: [stay('p', 'Berlin', 'DE', '2026-01-01', '2026-06-01')]}], {
        passport: 'DE',
      }),
      {asOf: '2026-06-01'},
    )
    expect(v.used).toBe(0)
    expect(v.permitExemption?.kind).toBe('free_movement')
  })
})

describe('refusals', () => {
  it('refuses rather than guessing for an uncovered passport', () => {
    const v = evaluate(snap(), traveller([{id: 'x', label: 'Trip', stays: [stay('x', 'Trip', 'FR', '2026-01-01', '2026-01-05')]}], {
      passport: 'ZZ',
    }), {asOf: '2026-01-05'})
    expect(v.ok).toBe(false)
    expect(v.refusal?.code).toBe('unknown_nationality')
  })

  it('refuses for a status it has never heard of', () => {
    const v = evaluate(snap(), traveller([{id: 'x', label: 'Trip', stays: [stay('x', 'Trip', 'FR', '2026-01-01', '2026-01-05')]}], {
      permitExemptionId: 'invented-permit',
    }), {asOf: '2026-01-05'})
    expect(v.ok).toBe(false)
    expect(v.refusal?.code).toBe('unknown_permit')
  })

  it('ignores an unknown territory and says so', () => {
    const v = evaluate(snap(), traveller([{id: 'x', label: 'Trip', stays: [stay('x', 'Trip', 'QQ', '2026-01-01', '2026-01-05')]}]), {
      asOf: '2026-01-05',
    })
    expect(v.ok).toBe(true)
    expect(v.warnings.join(' ')).toContain('Unknown territory')
  })
})

describe('determinism', () => {
  it('produces byte-identical verdicts for identical input', () => {
    const build = () =>
      traveller([
        {id: 'a', label: 'A', stays: [stay('a', 'A', 'FR', '2026-01-10', '2026-02-10')]},
        {id: 'b', label: 'B', stays: [stay('b', 'B', 'DE', '2026-03-01', '2026-04-15')]},
      ])

    const first = evaluate(snap(), build(), {asOf: '2026-04-14'})
    const second = evaluate(snap(), build(), {asOf: '2026-04-14'})
    expect(JSON.stringify(first)).toBe(JSON.stringify(second))
  })
})

describe('the last permissible day', () => {
  it('is open-ended once the window drains', () => {
    const v = evaluate(
      snap(),
      traveller([{id: 'a', label: 'A', stays: [stay('a', 'A', 'FR', '2024-01-01', '2024-01-11')]}]),
      {asOf: '2026-06-01'},
    )
    expect(v.lastPermissibleDay).toBeNull()
  })

  it('falls inside the final planned stay when the counter runs out', () => {
    const v = evaluate(
      snap(),
      traveller([
        {id: 'a', label: 'A', stays: [stay('a', 'A', 'FR', '2026-01-10', '2026-02-10')]},
        {id: 'b', label: 'B', stays: [stay('b', 'B', 'DE', '2026-03-01', '2026-04-15')]},
        {id: 'c', label: 'C', stays: [stay('c', 'C', 'PT', '2026-05-01', '2026-06-30')]},
      ]),
      {asOf: '2026-05-02'},
    )
    // 31 (Jan10–Feb9) + 45 (Mar1–Apr14) = 76 charged. May 1–14 brings the
    // counter to exactly 90, so May 14 is the last day that is still legal.
    expect(v.lastPermissibleDay).toBe('2026-05-14')
  })
})
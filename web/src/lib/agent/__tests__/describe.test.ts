/**
 * Date extraction is arithmetic, so it is tested like arithmetic.
 *
 * This file exists because the first version of these patterns used the wrong
 * capture group indices, so "1 to 21 February 2026" silently became a single
 * day — and because a single day is still a valid day, nothing complained.
 */
import {describe, expect, it} from 'vitest'
import {describeTrips} from '../describe'

const dates = (text: string) =>
  describeTrips(text).map((d) => [d.arrive, d.depart] as const)

describe('reading dates out of plain language', () => {
  it('reads a shared-month range', () => {
    expect(dates('I was in Rome from 1 to 21 February 2026')).toEqual([
      ['2026-02-01', '2026-02-21'],
    ])
  })

  it('reads a range with a dash and an en dash', () => {
    expect(dates('Rome 1–21 February 2026')).toEqual([['2026-02-01', '2026-02-21']])
    expect(dates('Rome 1 - 21 February 2026')).toEqual([['2026-02-01', '2026-02-21']])
  })

  it('reads a month-first range', () => {
    expect(dates('March 12 to 26, 2026 in Vienna')).toEqual([['2026-03-12', '2026-03-26']])
  })

  it('reads two ranges with different months', () => {
    expect(dates('Berlin 12 March 2026 to 26 April 2026')).toEqual([
      ['2026-03-12', '2026-04-26'],
    ])
  })

  it('reads ISO dates, which are unambiguous', () => {
    expect(dates('Split 2023-06-01 to 2023-06-15')).toEqual([['2023-06-01', '2023-06-15']])
  })

  it('reads a single date as a same-day visit', () => {
    expect(dates('I went to Monaco on 14 May 2026 for the day')).toEqual([
      ['2026-05-14', '2026-05-14'],
    ])
  })

  it('finds several trips in one description', () => {
    expect(
      dates('Lisbon 1 to 10 May 2026, then Berlin 12 to 20 May 2026, then Paris 1 to 5 June 2026'),
    ).toEqual([
      ['2026-05-01', '2026-05-10'],
      ['2026-05-12', '2026-05-20'],
      ['2026-06-01', '2026-06-05'],
    ])
  })

  it('rejects a date that does not exist rather than rolling it over', () => {
    expect(dates('I was in Rome 30 to 31 February 2026')).toEqual([])
  })

  it('returns nothing when no dates are stated', () => {
    expect(dates('some time last summer in France')).toEqual([])
  })

  it('keeps the traveller words about the place, minus the dates', () => {
    const [stay] = describeTrips('I took the train into Sofia from 1 to 11 February 2025')
    // placeText is lowercased on purpose: it goes straight to the classifier, and
    // lowercasing means "Sofia" and "sofia" cannot land as two different options.
    expect(stay.placeText).toBe('i took the train into sofia')
    expect(stay.placeText).not.toMatch(/february/i)
    expect(stay.arrive).toBe('2025-02-01')
    expect(stay.depart).toBe('2025-02-11')
  })

  it('notices the mode of travel from the traveller own words', () => {
    const [byAir] = describeTrips('I flew into Sofia 1 to 11 February 2025')
    const [byLand] = describeTrips('I took the train into Sofia 1 to 11 February 2025')
    expect(byAir.modeText).toBe('travelled by air')
    expect(byLand.modeText).toBe('crossed overland')
  })

  it('tells airside transit from a cleared transit', () => {
    const [airside] = describeTrips('layover at the airport on 3 June 2026, never cleared immigration')
    const [cleared] = describeTrips('layover at the airport on 3 June 2026, I cleared immigration')
    expect(airside.hintedKind).toBe('airport_transit')
    expect(cleared.hintedKind).toBe('airport_transit_landside')
  })

  it('gives each trip in a multi-trip description its own place', () => {
    // Regression: clause matching used to search for the ISO fragment of the
    // date, which never appears in human text, so every stay inherited the first
    // clause and "flew to Paris" was classified as Bulgaria.
    const stays = describeTrips(
      'I took the train into Sofia from 1 to 11 February 2025 for ten days, then flew to Paris 20 to 25 February 2025.',
    )
    expect(stays).toHaveLength(2)
    expect(stays[0]!.placeText).toContain('sofia')
    expect(stays[0]!.placeText).not.toContain('paris')
    expect(stays[1]!.placeText).toContain('paris')
    expect(stays[1]!.placeText).not.toContain('sofia')
  })

  it('gives each sentence its own place when the trips are separate sentences', () => {
    const stays = describeTrips(
      'Sofia 1 to 11 February 2025 by train. Paris 20 to 25 February 2025 by flight.',
    )
    expect(stays[0]!.placeText).toBe('sofia by train')
    expect(stays[1]!.placeText).toBe('paris by flight')
  })

  it('removes the date words from the place text', () => {
    // Regression: `\s` in a template literal collapses to `s`, so the strip
    // patterns compiled into "match a literal s" and silently removed nothing.
    const [stay] = describeTrips('three weeks on Tenerife from 1 to 21 February 2026')
    expect(stay.placeText).toBe('three weeks on tenerife')
  })

  it('names the mode per trip, not per description', () => {
    const stays = describeTrips(
      'Sofia 1 to 11 February 2025 by train. Paris 20 to 25 February 2025 by flight.',
    )
    expect(stays[0]!.modeText).toBe('crossed overland')
    expect(stays[1]!.modeText).toBe('travelled by air')
  })
})

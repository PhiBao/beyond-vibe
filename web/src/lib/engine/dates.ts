/**
 * Calendar-day arithmetic with no timezone ambiguity.
 *
 * A rule that says "the day you arrive counts and the day you leave does not"
 * is a statement about calendar days, not instants. Every date in this product
 * is a plain `YYYY-MM-DD` string and is converted to a UTC midnight epoch for
 * arithmetic, so a traveller in Tokyo and an engineer in Lisbon get identical
 * verdicts.
 */

export type IsoDate = string

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/

export function isIsoDate(value: unknown): value is IsoDate {
  if (typeof value !== 'string' || !ISO_RE.test(value)) return false
  const [y, m, d] = value.split('-').map(Number)
  if (m < 1 || m > 12) return false
  if (d < 1 || d > 31) return false
  // Reject impossible calendar dates such as 2026-02-30.
  return toIso(fromParts(y, m, d)) === value
}

export function assertIsoDate(value: unknown, label: string): asserts value is IsoDate {
  if (!isIsoDate(value)) {
    throw new RangeError(`${label} must be a real calendar date in YYYY-MM-DD form, got ${String(value)}`)
  }
}

/** Epoch days for a YYYY-MM-DD string. Day 0 is 1970-01-01. */
export function toEpochDay(value: IsoDate): number {
  assertIsoDate(value, 'date')
  const [y, m, d] = value.split('-').map(Number)
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000)
}

export function fromEpochDay(epochDay: number): IsoDate {
  return toIso(new Date(epochDay * 86_400_000))
}

interface Parts {
  y: number
  m: number
  d: number
}

function fromParts(y: number, m: number, d: number): Date {
  return new Date(Date.UTC(y, m - 1, d))
}

function toIso(date: Date): IsoDate {
  return date.toISOString().slice(0, 10)
}

export function addDays(value: IsoDate, days: number): IsoDate {
  return fromEpochDay(toEpochDay(value) + days)
}

/** Inclusive whole-day difference: days(a) - days(b). */
export function daysBetween(from: IsoDate, to: IsoDate): number {
  return toEpochDay(to) - toEpochDay(from)
}

/** Half-open range [from, to). Empty when from >= to. */
export function* eachDay(from: IsoDate, to: IsoDate): Generator<IsoDate> {
  if (!isIsoDate(from) || !isIsoDate(to)) {
    throw new RangeError(`eachDay requires real dates, got ${from} → ${to}`)
  }
  const start = toEpochDay(from)
  const end = toEpochDay(to)
  for (let day = start; day < end; day += 1) {
    yield fromEpochDay(day)
  }
}

/** Today as a calendar date. Injected so tests and the demo stay deterministic. */
export function today(now: Date = new Date()): IsoDate {
  return toIso(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())))
}
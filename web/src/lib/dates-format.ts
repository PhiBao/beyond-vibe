/** Calendar-date formatting. No timezone involved: these are days, not instants. */

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

const DAYS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
]

export function parts(iso: string): {y: number; m: number; d: number} {
  const [y, m, d] = iso.split('-').map(Number)
  return {y, m, d}
}

export function weekday(iso: string): string {
  const {y, m, d} = parts(iso)
  return DAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]
}

export function dayOfMonth(iso: string): number {
  return parts(iso).d
}

export function monthName(iso: string): string {
  return MONTHS[parts(iso).m - 1]
}

export function monthShort(iso: string): string {
  return MONTHS[parts(iso).m - 1].slice(0, 3)
}

export function isFirstOfMonth(iso: string): boolean {
  return parts(iso).d === 1
}

/** "Sat 25 Oct 2026" */
export function longDate(iso: string): string {
  return `${weekday(iso).slice(0, 3)} ${dayOfMonth(iso)} ${monthShort(iso)} ${parts(iso).y}`
}

/** "25 October 2026" */
export function plainDate(iso: string): string {
  return `${dayOfMonth(iso)} ${monthName(iso)} ${parts(iso).y}`
}
import type {DayClassification} from '@/lib/engine/types'


interface TripRow {
  id: string
  label: string
  territory: string
  arrive: string
  depart: string
  days: number
  charged: number
  note?: string | null
  ruledByPerson: boolean
}

/**
 * Where the days went, per trip.
 *
 * The columns that matter are the two the market never shows: how many days this
 * trip actually cost you, and whether the answer came from the base rule or from
 * a person.
 */
export function TripTable({
  ledger,
  windowDays,
}: {
  ledger: DayClassification[]
  windowDays?: number
}) {
  const rows = new Map<string, TripRow>()

  for (const day of ledger) {
    if (!day.tripId) continue
    let row = rows.get(day.tripId)
    if (!row) {
      row = {
        id: day.tripId,
        label: day.tripLabel ?? 'Trip',
        territory: day.territoryName ?? 'Unknown',
        arrive: day.date,
        depart: day.date,
        days: 0,
        charged: 0,
        ruledByPerson: false,
      }
      rows.set(day.tripId, row)
    }
    row.days += 1
    if (day.charged) row.charged += 1
    if (day.date < row.arrive) row.arrive = day.date
    if (day.date > row.depart) row.depart = day.date
    if (day.byPrecedent) row.ruledByPerson = true
  }

  const list = [...rows.values()].sort((a, b) => a.arrive.localeCompare(b.arrive))
  if (list.length === 0) return null

  const totalCharged = list.reduce((sum, r) => sum + r.charged, 0)
  const free = list.filter((r) => r.charged === 0)

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-[var(--line)] text-[10px] uppercase tracking-widest text-[var(--faint)]">
            <th className="py-2 pr-4 font-normal">Trip</th>
            <th className="py-2 pr-4 font-normal">Where</th>
            <th className="py-2 pr-4 font-normal">Dates</th>
            <th className="py-2 pr-4 text-right font-normal">Days</th>
            <th className="py-2 pr-4 text-right font-normal">Cost you</th>
          </tr>
        </thead>
        <tbody>
          {list.map((row) => {
            const free = row.charged === 0
            return (
              <tr key={row.id} className="border-b border-[var(--line-soft)] align-top">
                <td className="py-3 pr-4">
                  <span className="text-[var(--text)]">{row.label}</span>
                  {row.ruledByPerson ? (
                    <span className="ml-2 rounded border border-[var(--unresolved)]/50 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-[var(--unresolved)]">
                      ruled by a person
                    </span>
                  ) : null}
                  {row.note ? (
                    <span className="mt-1 block text-xs text-[var(--muted)]">{row.note}</span>
                  ) : null}
                </td>
                <td className="py-3 pr-4 text-[var(--muted)]">{row.territory}</td>
                <td className="mono py-3 pr-4 text-xs text-[var(--muted)]">
                  {row.arrive.slice(5)} → {row.depart.slice(5)}
                  <span className="mt-1 block text-[var(--faint)]">
                    {row.arrive.slice(0, 4)}
                  </span>
                </td>
                <td className="mono py-3 pr-4 text-right text-[var(--muted)]">{row.days}</td>
                <td className="py-3 text-right">
                  <span
                    className="mono text-base"
                    style={{color: free ? 'var(--faint)' : 'var(--charged)'}}
                  >
                    {row.charged}
                  </span>
                  {free ? (
                    <span className="mt-1 block text-[10px] uppercase tracking-wide text-[var(--faint)]">
                      free
                    </span>
                  ) : null}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <div className="mt-4 space-y-2 text-xs leading-relaxed text-[var(--faint)]">
        <p>
          This table counts every charged day in your history —{' '}
          <strong className="text-[var(--muted)]">{totalCharged} in total</strong>. Only days
          inside the current {windowDays ?? 180}-day window count toward the limit; older
          ones have already aged out, which is why this number is larger than the one at
          the top of the page.
        </p>
        {free.length > 0 ? (
          <p>
            {free.length} trip{free.length === 1 ? '' : 's'} cost you nothing:{' '}
            {free.map((r) => r.label).join(', ')}. That is not a bookkeeping error — those
            days never entered the counter.
          </p>
        ) : null}
      </div>
    </div>
  )
}
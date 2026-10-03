'use client'

import {useMemo} from 'react'
import type {DayClassification} from '@/lib/engine/types'
import {dayOfMonth, isFirstOfMonth, longDate, monthName} from '@/lib/dates-format'

interface DayLedgerProps {
  ledger: DayClassification[]
  breachDate: string | null
  lastPermissibleDay: string | null
  selected: string | null
  onSelect: (date: string) => void
}

/**
 * The day ledger: one mark per calendar day, in order, across the whole history.
 *
 * This is the product. A number tells you that you are over; a strip of days
 * tells you *which* days and *why*, and the breach lands somewhere you can see
 * it land rather than in a sentence you have to trust.
 */
export function DayLedger({
  ledger,
  breachDate,
  lastPermissibleDay,
  selected,
  onSelect,
}: DayLedgerProps) {
  // Trim leading and trailing runs of unvisited days so the interesting span
  // gets the width. Gaps inside the span are preserved.
  const {marks, monthTicks, breachIndex, lastOkIndex} = useMemo(() => {
    const first = ledger.findIndex((d) => d.tripId !== null || d.charged)
    let last = -1
    for (let i = ledger.length - 1; i >= 0; i -= 1) {
      if (ledger[i].tripId !== null || ledger[i].charged) {
        last = i
        break
      }
    }
    const slice = first === -1 ? [] : ledger.slice(first, last + 1)

    const ticks: Array<{index: number; label: string}> = []
    slice.forEach((day, index) => {
      if (isFirstOfMonth(day.date) || index === 0) {
        ticks.push({index, label: monthName(day.date).slice(0, 3)})
      }
    })

    return {
      marks: slice,
      monthTicks: ticks,
      breachIndex: breachDate ? slice.findIndex((d) => d.date === breachDate) : -1,
      lastOkIndex: lastPermissibleDay
        ? slice.findIndex((d) => d.date === lastPermissibleDay)
        : -1,
    }
  }, [ledger, breachDate, lastPermissibleDay])

  if (marks.length === 0) {
    return (
      <p className="py-8 text-sm text-[var(--muted)]">
        No presence recorded, so there is nothing to lay out.
      </p>
    )
  }

  const pct = (index: number) => (index < 0 ? null : (index / marks.length) * 100)

  return (
    <div>
      <div className="relative">
        {/* Month scale, plus the breach marker on the same row as the labels. */}
        <div className="relative mb-2 h-5" aria-hidden>
          {monthTicks.map((tick) => (
            <span
              key={`${tick.index}-${tick.label}`}
              className="absolute top-0 text-[10px] uppercase tracking-widest text-[var(--faint)]"
              style={{left: `${(tick.index / marks.length) * 100}%`}}
            >
              {tick.label}
            </span>
          ))}

          {pct(breachIndex) !== null ? (
            <span
              className="absolute -top-0.5 -translate-x-1/2 whitespace-nowrap rounded bg-[var(--danger)] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-white"
              style={{left: `${pct(breachIndex)}%`}}
            >
              over
            </span>
          ) : null}
        </div>

        {/* The strip */}
        <div className="flex h-16 items-stretch gap-px" role="list" aria-label="Day by day ledger">
          {marks.map((day) => {
            const isBreach = day.date === breachDate
            const tone = isBreach
              ? 'mark-breach'
              : day.verdict === 'unresolved'
                ? 'mark-unresolved'
                : day.charged
                  ? 'mark-charged'
                  : day.territoryName
                    ? 'mark-outside'
                    : 'mark-clear'

            const label = [
              longDate(day.date),
              day.territoryName ?? 'not present',
              day.charged ? 'counted' : day.verdict === 'unresolved' ? 'undecided' : 'not counted',
              day.reason,
            ].join(' — ')

            return (
              <button
                key={day.date}
                type="button"
                role="listitem"
                onClick={() => onSelect(day.date)}
                data-selected={selected === day.date}
                title={label}
                aria-label={label}
                className="row-hover relative flex-1 cursor-pointer border-0 bg-transparent p-0"
              >
                <span className={`mark ${tone}`} style={{height: '100%'}} />
              </button>
            )
          })}
        </div>

        {pct(lastOkIndex) !== null ? (
          <p className="mt-2 text-xs text-[var(--faint)]">
            <span
              className="mr-1.5 inline-block h-2.5 w-px translate-y-0.5 bg-[var(--danger)] align-middle"
              aria-hidden
            />
            {longDate(lastPermissibleDay as string)} — the last day this itinerary keeps you
            legal.
          </p>
        ) : null}
      </div>

      <Legend />
    </div>
  )
}

function Legend() {
  const items: Array<[string, string]> = [
    ['mark-charged', 'counted'],
    ['mark-outside', 'outside the area'],
    ['mark-clear', 'not present'],
    ['mark-unresolved', 'needs a ruling'],
    ['mark-breach', 'over the limit'],
  ]
  return (
    <ul className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-xs text-[var(--muted)]">
      {items.map(([tone, label]) => (
        <li key={label} className="flex items-center gap-2">
          <span className={`swatch ${tone}`} aria-hidden />
          <span>{label}</span>
        </li>
      ))}
    </ul>
  )
}
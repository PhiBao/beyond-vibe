'use client'

import type {DayClassification} from '@/lib/engine/types'
import {longDate} from '@/lib/dates-format'

/**
 * Why one day resolved the way it did, with the authorities behind it.
 *
 * Every classification the engine makes resolves to at least one source. This
 * panel is where that promise is kept, so a claim can be checked rather than
 * believed.
 */
export function DayDetail({day}: {day: DayClassification | null}) {
  if (!day) {
    return (
      <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-6 text-sm text-[var(--muted)]">
        Pick any day in the ledger above to see why it counted.
      </div>
    )
  }

  const tone =
    day.verdict === 'unresolved'
      ? 'var(--unresolved)'
      : day.charged
        ? 'var(--charged)'
        : 'var(--muted)'

  return (
    <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h3 className="mono text-lg text-[var(--text)]">{longDate(day.date)}</h3>
        <span
          className="text-xs font-medium uppercase tracking-widest"
          style={{color: tone}}
        >
          {day.verdict === 'unresolved'
            ? 'undecided'
            : day.charged
              ? 'counted against you'
              : 'not counted'}
        </span>
      </div>

      {day.territoryName ? (
        <p className="mt-1 text-sm text-[var(--muted)]">
          {day.territoryName}
          {day.tripLabel ? ` · ${day.tripLabel}` : ''}
        </p>
      ) : (
        <p className="mt-1 text-sm text-[var(--muted)]">Not present anywhere.</p>
      )}

      <p className="mt-4 max-w-prose text-[15px] leading-relaxed text-[var(--text)]">
        {day.reason}
      </p>

      {day.byPrecedent ? (
        <p className="mt-4 rounded border border-[var(--line-soft)] bg-[var(--panel-2)] px-3 py-2 text-xs text-[var(--muted)]">
          This day was decided by a person, not by the base rule. That decision is
          stored as precedent and now applies to every future trip.
        </p>
      ) : null}

      {day.alternative ? (
        <p className="mt-4 rounded border border-[var(--unresolved)]/40 bg-[var(--unresolved)]/10 px-3 py-2 text-xs text-[var(--unresolved)]">
          Under the other reading this day would be{' '}
          <strong>{day.alternative === 'counts' ? 'counted' : 'not counted'}</strong>. Until
          someone rules on it, the count is a range rather than a number.
        </p>
      ) : null}

      {day.sourceRefs.length > 0 ? (
        <div className="mt-5 border-t border-[var(--line-soft)] pt-4">
          <h4 className="text-[10px] uppercase tracking-widest text-[var(--faint)]">
            Sources
          </h4>
          <ul className="mt-2 space-y-2">
            {day.sourceRefs.map((source) => (
              <li key={source.id} className="text-xs leading-relaxed">
                <a
                  href={source.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-[var(--text)] underline decoration-[var(--line)] underline-offset-4 hover:decoration-[var(--charged)]"
                >
                  {source.title}
                </a>
                <span className="block text-[var(--faint)]">
                  {source.publisher}
                  {source.retrievedAt ? ` · read ${source.retrievedAt.slice(0, 10)}` : ''}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
import type {EngineVerdict} from '@/lib/engine/types'
import {longDate, plainDate} from '@/lib/dates-format'

/**
 * The headline. Three facts, in priority order: how much is left, the exact day
 * it breaks, and the smallest edit that prevents it.
 */
export function VerdictHero({
  verdict,
  asOf,
}: {
  verdict: EngineVerdict
  asOf: string
}) {
  if (!verdict.ok) {
    return (
      <section className="rounded-lg border border-[var(--unresolved)]/40 bg-[var(--panel)] p-8">
        <h2 className="mono text-xl text-[var(--unresolved)]">Ninety declined to answer</h2>
        <p className="mt-3 max-w-prose text-[15px] leading-relaxed text-[var(--muted)]">
          {verdict.refusal?.message} It would rather refuse than guess, because a
          confident wrong number here is worth more to nobody.
        </p>
      </section>
    )
  }

  const pct = Math.min(100, Math.round((verdict.used / verdict.limitDays) * 100))
  const over = verdict.remaining < 0

  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-[var(--faint)]">
            Used, as of {longDate(asOf)}
          </p>
          <p className="mono mt-1 text-6xl leading-none text-[var(--text)]">
            {verdict.used}
            <span className="text-3xl text-[var(--faint)]"> / {verdict.limitDays}</span>
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-widest text-[var(--faint)]">
            {over ? 'Over by' : 'Left to spend'}
          </p>
          <p
            className="mono mt-1 text-4xl leading-none"
            style={{color: over ? 'var(--danger)' : 'var(--charged)'}}
          >
            {Math.abs(verdict.remaining)}
          </p>
        </div>
      </div>

      <Meter used={verdict.used} limit={verdict.limitDays} pct={pct} />

      {verdict.attribution ? (
        <div className="mt-8 rounded-lg border border-[var(--danger)]/40 bg-[var(--panel)] p-6">
          <h2 className="text-[10px] uppercase tracking-widest text-[var(--danger)]">
            You cross the limit here
          </h2>
          <p className="mt-3 text-[17px] leading-relaxed text-[var(--text)]">
            On{' '}
            <strong className="mono text-[var(--danger)]">
              {plainDate(verdict.attribution.date)}
            </strong>{' '}
            the rolling {verdict.windowDays}-day window reaches{' '}
            <strong className="mono">{verdict.attribution.count}</strong> days.
            {verdict.attribution.blame.length > 0 ? (
              <>
                {' '}
                It is{' '}
                {verdict.attribution.blame
                  .map((b) => b.tripLabel ?? 'a trip you have not named')
                  .join(', ')}
                {' '}that puts you over.
              </>
            ) : null}
          </p>

          {verdict.repair?.kind === 'shorten_stay' ? (
            <p className="mt-4 rounded border border-[var(--line)] bg-[var(--panel-2)] px-4 py-3 text-[15px] leading-relaxed text-[var(--text)]">
              {verdict.repair.instruction}
            </p>
          ) : null}

          {verdict.lastPermissibleDay ? (
            <p className="mt-4 text-sm text-[var(--muted)]">
              Your last permissible day is{' '}
              <strong className="mono text-[var(--text)]">
                {plainDate(verdict.lastPermissibleDay)}
              </strong>
              . After that, the next 180 days cannot absorb the trip you have
              booked.
            </p>
          ) : null}
        </div>
      ) : (
        <div className="mt-8 rounded-lg border border-[var(--line)] bg-[var(--panel)] p-6">
          <h2 className="text-[10px] uppercase tracking-widest text-[var(--faint)]">
            Inside the limit
          </h2>
          <p className="mt-3 text-[15px] leading-relaxed text-[var(--text)]">
            Nothing in this history breaks the allowance.{' '}
            {verdict.remaining > 0
              ? `You have ${verdict.remaining} day${verdict.remaining === 1 ? '' : 's'} left to spend.`
              : ''}{' '}
            {verdict.lastPermissibleDay
              ? `Staying up to ${plainDate(verdict.lastPermissibleDay)} keeps you legal.`
              : 'There is no date by which you must leave.'}
          </p>
        </div>
      )}

      {verdict.unresolvedDays.length > 0 ? (
        <p className="mt-4 rounded border border-[var(--unresolved)]/40 bg-[var(--unresolved)]/10 px-4 py-3 text-sm text-[var(--unresolved)]">
          {verdict.unresolvedDays.length} day
          {verdict.unresolvedDays.length === 1 ? '' : 's'} could not be settled without a
          person. The number above is the count with those days excluded.
        </p>
      ) : null}
    </section>
  )
}

function Meter({used, limit, pct}: {used: number; limit: number; pct: number}) {
  const over = used > limit
  return (
    <div
      className="mt-6 h-1.5 w-full overflow-hidden rounded-full bg-[var(--clear)]"
      role="meter"
      aria-valuenow={used}
      aria-valuemin={0}
      aria-valuemax={limit}
      aria-label={`${used} of ${limit} days used`}
    >
      <div
        className="h-full rounded-full transition-[width] duration-500"
        style={{
          width: `${pct}%`,
          background: over ? 'var(--danger)' : 'var(--charged)',
        }}
      />
    </div>
  )
}
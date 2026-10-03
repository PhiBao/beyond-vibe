'use client'

import {useMemo, useState} from 'react'
import type {EngineVerdict, ItineraryInput} from '@/lib/engine/types'

/**
 * Bring your own history.
 *
 * Deliberately a textarea rather than a form builder. The input is a list of
 * dated ranges, which is what the problem actually is, and a fiddly trip editor
 * would be more interface than the domain deserves.
 *
 * Format: `TERRITORY ARRIVE DEPART`, one per line. Territory is the code shown
 * in the list; an unknown code is refused by the server with a named error.
 */
export function CustomTrips({
  territories,
  onResult,
  onError,
}: {
  territories: Array<{code: string; name: string; countedByDefault: boolean}>
  onResult: (verdict: EngineVerdict, label: string) => void
  onError: (message: string | null) => void
}) {
  const [passport, setPassport] = useState('US')
  const [lines, setLines] = useState(
    ['FR 2026-09-01 2026-09-20', 'ES 2026-10-05 2026-10-18'].join('\n'),
  )
  const [pending, setPending] = useState(false)

  const parsed = useMemo(() => parse(lines), [lines])

  async function submit() {
    setPending(true)
    onError(null)
    try {
      const input: ItineraryInput = {
        holder: {passport: passport.trim().toUpperCase()},
        trips: parsed.trips,
      }
      const res = await fetch('/api/evaluate', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(input),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? 'Could not evaluate that.')
      onResult(data.verdict as EngineVerdict, `${passport.toUpperCase()} · ${parsed.trips.length} trip(s)`)
    } catch (e) {
      onError((e as Error).message)
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="grid gap-6 md:grid-cols-[1fr_auto]">
      <div>
        <label className="block text-xs text-[var(--muted)]">
          <span className="mb-1 block text-[10px] uppercase tracking-widest text-[var(--faint)]">
            Passport
          </span>
          <input
            value={passport}
            onChange={(e) => setPassport(e.target.value.toUpperCase().slice(0, 2))}
            className="mono w-24 rounded border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--charged)]"
          />
        </label>

        <label className="mt-4 block text-xs text-[var(--muted)]">
          <span className="mb-1 block text-[10px] uppercase tracking-widest text-[var(--faint)]">
            One trip per line — territory, arrival, departure
          </span>
          <textarea
            value={lines}
            onChange={(e) => setLines(e.target.value)}
            rows={6}
            spellCheck={false}
            className="mono w-full rounded border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--charged)]"
          />
        </label>

        {parsed.problems.length > 0 ? (
          <ul className="mt-3 space-y-1 text-xs text-[var(--danger)]">
            {parsed.problems.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="flex flex-col justify-end gap-4">
        <button
          type="button"
          onClick={submit}
          disabled={pending || parsed.problems.length > 0 || parsed.trips.length === 0}
          className="rounded bg-[var(--text)] px-5 py-2.5 text-sm font-medium text-[var(--ink)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {pending ? 'Counting…' : 'Count my days'}
        </button>

        <div className="text-xs text-[var(--faint)]">
          <p className="mb-1 uppercase tracking-widest">Territories</p>
          <p className="max-w-xs leading-relaxed">
            {territories
              .slice(0, 40)
              .map((t) => t.code)
              .join(' ')}
          </p>
        </div>
      </div>
    </div>
  )
}

/** Parse the textarea into engine input, collecting problems instead of throwing. */
export function parse(raw: string): {trips: ItineraryInput['trips']; problems: string[]} {
  const trips: ItineraryInput['trips'] = []
  const problems: string[] = []

  raw
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .forEach((line, index) => {
      const parts = line.split(/[\s,]+/).filter(Boolean)
      if (parts.length < 3) {
        problems.push(`Line ${index + 1}: expected "TERRITORY ARRIVE DEPART".`)
        return
      }
      const [territory, arrive, depart] = parts
      trips.push({
        id: `line-${index}`,
        label: `${territory} ${arrive} → ${depart}`,
        stays: [
          {
            tripId: `line-${index}`,
            tripLabel: `${territory} ${arrive} → ${depart}`,
            territoryCode: territory.toUpperCase(),
            arrive,
            depart,
            mode: 'land',
          },
        ],
      })
    })

  return {trips, problems}
}
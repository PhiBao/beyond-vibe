'use client'

import {useState} from 'react'
import type {EngineVerdict} from '@/lib/engine/types'

/**
 * Describe a trip the way you would to a friend.
 *
 * This is the agent. It exists because the structured interface above demands the
 * one thing most people do not have: a classification. You can count your own
 * dates in your head; you cannot reliably decide whether an airport transit
 * counts, and the dropdown asked you to know that in advance.
 *
 * What the agent does, and what it is forbidden from doing:
 *
 *   Sanity Context  →  the candidate set, retrieved from the corpus, never invented
 *   TypeSafe        →  typed classification with a calibrated confidence
 *   the engine      →  every number in the answer
 *
 * The confidence is shown rather than hidden, and the read is refused when it is
 * low. A traveller is owed the difference between "I know" and "I think".
 */

interface Resolution {
  stays: Array<{
    index: number
    placeText: string
    arrive: string
    depart: string
    territoryCode: string
    territoryName: string
    presenceKind: string
    presenceLabel: string
    countsTowardsAllowance: number
    confidence: number
    uncertain: boolean
  }>
  corpusFrom: string
  model: string | null
}

const EXAMPLES = [
  'I spent three weeks on Tenerife from 1 to 21 February 2026.',
  'Took the train into Sofia 1 to 11 February 2025, ten days.',
  'Layover at an airport on 3 June 2026, never cleared immigration.',
]

export function AgentAsk({onResult}: {onResult: (verdict: EngineVerdict, label: string) => void}) {
  const [text, setText] = useState('')
  const [passport, setPassport] = useState('US')
  const [pending, setPending] = useState(false)
  const [resolution, setResolution] = useState<Resolution | null>(null)
  const [problem, setProblem] = useState<string | null>(null)

  async function submit() {
    setPending(true)
    setProblem(null)
    setResolution(null)
    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({text, passport: passport.trim().toUpperCase()}),
      })
      const data = await res.json()

      if (!res.ok || !data.ok) {
        setProblem(data.message ?? data.hint ?? data.error ?? 'That did not work.')
        return
      }

      setResolution(data.resolution)
      onResult(data.verdict, 'your description')
    } catch {
      setProblem('Could not reach the agent.')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h3 className="text-[15px] font-medium text-[var(--text)]">
          Or just describe the trip
        </h3>
        <span className="mono text-[11px] text-[var(--faint)]">
          Sanity Context → TypeSafe → engine
        </span>
      </div>

      <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-[var(--muted)]">
        The agent reads your words against the corpus to work out which place and
        which kind of visit this is, then the engine counts the days. It shows its
        confidence, and it will not answer when it is unsure.
      </p>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        placeholder="I took the train into Sofia from 1 to 11 February 2025 for ten days."
        className="mt-4 w-full resize-y rounded border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-[14px] leading-relaxed text-[var(--text)] outline-none placeholder:text-[var(--faint)] focus:border-[var(--text)]"
      />

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-[13px] text-[var(--muted)]">
          Passport
          <input
            value={passport}
            onChange={(e) => setPassport(e.target.value)}
            maxLength={2}
            className="mono w-14 rounded border border-[var(--line)] bg-[var(--bg)] px-2 py-1 text-[13px] text-[var(--text)] uppercase outline-none focus:border-[var(--text)]"
          />
        </label>

        <button
          onClick={submit}
          disabled={pending || text.trim().length === 0}
          className="rounded bg-[var(--text)] px-4 py-1.5 text-[13px] font-medium text-[var(--ink)] transition-opacity disabled:opacity-40"
        >
          {pending ? 'Reading…' : 'Work it out'}
        </button>

        <div className="flex flex-wrap gap-2">
          {EXAMPLES.map((e) => (
            <button
              key={e}
              onClick={() => setText(e)}
              className="text-[11px] text-[var(--faint)] underline decoration-transparent underline-offset-4 hover:text-[var(--muted)] hover:decoration-[var(--line)]"
            >
              {e.slice(0, 34)}…
            </button>
          ))}
        </div>
      </div>

      {problem ? (
        <p className="mt-4 rounded border border-[var(--unresolved)]/40 bg-[var(--panel)] px-4 py-3 text-[13px] leading-relaxed text-[var(--text)]">
          {problem}
        </p>
      ) : null}

      {resolution ? (
        <div className="mt-5">
          <p className="mono text-[11px] text-[var(--faint)]">
            resolved against{' '}
            {resolution.corpusFrom === 'sanity-context' ? 'Sanity Context' : 'the bundled corpus'}
            {resolution.model ? ` · ${resolution.model}` : ''}
          </p>

          <ul className="mt-3 space-y-2">
            {resolution.stays.map((s) => (
              <li key={s.index} className="rounded border border-[var(--line-soft)] px-4 py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-[14px] text-[var(--text)]">
                    {s.arrive} → {s.depart}
                  </span>
                  <span
                    className={`mono text-[11px] ${
                      s.uncertain
                        ? 'text-[var(--unresolved)]'
                        : s.countsTowardsAllowance > 0
                          ? 'text-[var(--muted)]'
                          : 'text-[var(--safe)]'
                    }`}
                  >
                    {s.uncertain
                      ? 'not confident enough'
                      : s.countsTowardsAllowance > 0
                        ? `${s.countsTowardsAllowance} day${s.countsTowardsAllowance === 1 ? '' : 's'} counted`
                        : 'no days counted'}
                    {' · '}
                    {Math.round(s.confidence * 100)}%
                  </span>
                </div>
                <p className="mt-1 text-[13px] text-[var(--muted)]">
                  &ldquo;{s.placeText || 'no place named'}&rdquo; →{' '}
                  <strong className="font-medium text-[var(--text)]">{s.territoryName}</strong>
                </p>
                <p className="mt-0.5 text-[12px] text-[var(--faint)]">{s.presenceLabel}</p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}

'use client'

import Link from 'next/link'
import {useState} from 'react'
import {CustomTrips} from '@/components/custom-trips'
import {AgentAsk} from '@/components/agent-ask'
import {DayDetail} from '@/components/day-detail'
import {DayLedger} from '@/components/day-ledger'
import {DisputeDesk, type DisputeView} from '@/components/dispute-desk'
import {TripTable} from '@/components/trip-table'
import {VerdictHero} from '@/components/verdict-hero'
import type {DayClassification, EngineVerdict} from '@/lib/engine/types'

export interface AppItinerary {
  slug: string
  title: string
  summary: string | null
  verdict: EngineVerdict
}

interface NinetyAppProps {
  itineraries: AppItinerary[]
  disputes: DisputeView[]
  territories: Array<{code: string; name: string; countedByDefault: boolean}>
  asOf: string
  dataSource: 'sanity' | 'local'
  projectId: string
}

export function NinetyApp(props: NinetyAppProps) {
  return <Inner {...props} />
}

function Inner({
  itineraries: initialItineraries,
  disputes: initialDisputes,
  territories,
  asOf,
  dataSource,
  projectId,
}: NinetyAppProps) {
  const [itineraries, setItineraries] = useState(initialItineraries)
  const [disputes, setDisputes] = useState(initialDisputes)
  const [activeSlug, setActiveSlug] = useState(initialItineraries[0]?.slug ?? '')
  // Open on the breach day: the most informative cell in the strip. An empty
  // panel on first paint wastes the strongest thing on the page.
  const [selectedDate, setSelectedDate] = useState<string | null>(
    initialItineraries[0]?.verdict?.attribution?.date ?? null,
  )
  const [custom, setCustom] = useState<{verdict: EngineVerdict; label: string} | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [decidedBy, setDecidedBy] = useState('')
  const [busy, setBusy] = useState(false)

  const active = itineraries.find((i) => i.slug === activeSlug) ?? itineraries[0]
  const verdict = custom?.verdict ?? active?.verdict
  const ledger: DayClassification[] = verdict?.ledger ?? []
  const selected = ledger.find((d) => d.date === selectedDate) ?? null

  async function adjudicate(dispute: DisputeView, outcome: 'counts' | 'does_not_count') {
    setError(null)
    setBusy(true)
    try {
      const res = await fetch('/api/adjudicate', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({disputeId: dispute.id, outcome, decidedBy}),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? 'That ruling was rejected.')
      setItineraries(
        data.itineraries as Array<AppItinerary & {verdict: EngineVerdict}>,
      )
      setDisputes(data.disputes as DisputeView[])
      setCustom(null)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10 sm:px-8">
      <header className="flex flex-wrap items-end justify-between gap-6 border-b border-[var(--line)] pb-8">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Ninety</h1>
          <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-[var(--muted)]">
            Every short-stay calculator tells you how many days you have used. None of
            them tell you the day you went over. Ninety computes your allowance day by
            day, names the exact date it breaks, and hands you the smallest edit that
            prevents it.
          </p>
        </div>
        <nav className="flex flex-wrap gap-5 text-sm text-[var(--muted)]">
          {[
            ['#ledger', 'Ledger'],
            ['#own', 'Your trips'],
            ['#desk', 'The desk'],
            ['#how', 'How it works'],
          ].map(([href, label]) => (
            <a
              key={href}
              href={href}
              className="underline decoration-transparent underline-offset-4 hover:text-[var(--text)] hover:decoration-[var(--line)]"
            >
              {label}
            </a>
          ))}
        </nav>
      </header>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <div role="tablist" aria-label="Choose an example" className="flex flex-wrap gap-2">
          {itineraries.map((it) => (
            <button
              key={it.slug}
              role="tab"
              type="button"
              aria-selected={!custom && activeSlug === it.slug}
              onClick={() => {
                const next = itineraries.find((i) => i.slug === it.slug)
                setActiveSlug(it.slug)
                setCustom(null)
                setSelectedDate(next?.verdict?.attribution?.date ?? null)
              }}
              className={`rounded px-3 py-1.5 text-sm transition-colors ${
                !custom && activeSlug === it.slug
                  ? 'bg-[var(--text)] text-[var(--ink)]'
                  : 'border border-[var(--line)] text-[var(--muted)] hover:border-[var(--text)] hover:text-[var(--text)]'
              }`}
            >
              {it.title}
            </button>
          ))}
          {custom ? (
            <span className="rounded bg-[var(--text)] px-3 py-1.5 text-sm text-[var(--ink)]">
              Your trips
            </span>
          ) : null}
        </div>
        <p className="text-xs text-[var(--faint)]">{custom?.label ?? active?.summary}</p>
      </div>

      <section className="mt-10">
        {verdict ? <VerdictHero verdict={verdict} asOf={asOf} /> : null}
      </section>

      <section id="ledger" className="mt-14 scroll-mt-8">
        <h2 className="text-[10px] uppercase tracking-widest text-[var(--faint)]">
          The ledger — every day, and why
        </h2>
        <div className="mt-5">
          <DayLedger
            ledger={ledger}
            breachDate={verdict?.attribution?.date ?? null}
            lastPermissibleDay={verdict?.lastPermissibleDay ?? null}
            selected={selectedDate}
            onSelect={setSelectedDate}
          />
        </div>
        <div className="mt-6 grid items-start gap-6 lg:grid-cols-[1.4fr_1fr]">
          <DayDetail day={selected} />
          <div>
            <h3 className="mb-3 text-[10px] uppercase tracking-widest text-[var(--faint)]">
              Where the days went
            </h3>
            <TripTable ledger={ledger} windowDays={verdict?.windowDays} />
          </div>
        </div>
      </section>

      <section id="own" className="mt-16 scroll-mt-8">
        <h2 className="text-[10px] uppercase tracking-widest text-[var(--faint)]">
          Run your own history
        </h2>
        <div className="mt-5">
          <CustomTrips
            territories={territories}
            onResult={(next, label) => {
              setCustom({verdict: next, label})
              setSelectedDate(null)
              setError(null)
            }}
            onError={setError}
          />
        </div>

        <div className="mt-5">
          <AgentAsk
            onResult={(next, label) => {
              setCustom({verdict: next, label})
              setSelectedDate(null)
              setError(null)
            }}
          />
        </div>
      </section>

      <section id="desk" className="mt-16 scroll-mt-8">
        <h2 className="text-[10px] uppercase tracking-widest text-[var(--faint)]">
          The desk — where sources disagree
        </h2>
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-[var(--muted)]">
          When the corpus genuinely conflicts, Ninety refuses to classify the day and
          reports a range instead. A person rules once; the ruling is written as
          precedent, and every later calculation reads it.
        </p>

        <label className="mt-6 block text-xs text-[var(--muted)]">
          <span className="mb-1 block text-[10px] uppercase tracking-widest text-[var(--faint)]">
            Your name, so the ruling is attributable
          </span>
          <input
            value={decidedBy}
            onChange={(e) => setDecidedBy(e.target.value)}
            placeholder="e.g. Sam"
            className="w-56 rounded border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-sm text-[var(--text)] outline-none placeholder:text-[var(--faint)] focus:border-[var(--charged)]"
          />
        </label>

        <div className="mt-5">
          <DisputeDesk disputes={disputes} onAdjudicate={adjudicate} busy={busy} />
        </div>

        {error ? (
          <p className="mt-4 rounded border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-4 py-3 text-sm text-[var(--danger)]">
            {error}
          </p>
        ) : null}
      </section>

      <section id="how" className="mt-16 scroll-mt-8 border-t border-[var(--line)] pt-10">
        <h2 className="text-[10px] uppercase tracking-widest text-[var(--faint)]">
          How it works
        </h2>
        <div className="mt-5 grid gap-8 text-[15px] leading-relaxed text-[var(--muted)] md:grid-cols-3">
          <div>
            <h3 className="text-[var(--text)]">No model in the loop</h3>
            <p className="mt-2">
              The verdict is computed. A deterministic engine resolves the membership,
              visa regime, permit and presence rules that apply on each individual day,
              then counts a rolling window. The same history always gives the same
              answer, and you can check it by hand.
            </p>
          </div>
          <div>
            <h3 className="text-[var(--text)]">Structure, not retrieval</h3>
            <p className="mt-2">
              Whether a day counts depends on territory membership{' '}
              <em>on that date</em> and by which mode of arrival, on your nationality
              class, and on your permit. That answer is not in any single document — it
              is the result of a join, which is why keyword search cannot produce it.
            </p>
          </div>
          <div>
            <h3 className="text-[var(--text)]">It refuses rather than guesses</h3>
            <p className="mt-2">
              An uncovered passport, an unknown permit or an undecided day produces a
              visible refusal, not a plausible number. A confident wrong answer here
              costs someone money.
            </p>
          </div>
        </div>
      </section>

      <footer className="mt-16 border-t border-[var(--line)] pt-8 text-xs leading-relaxed text-[var(--faint)]">
        <p>
          Sanity project <span className="mono text-[var(--muted)]">{projectId}</span>,
          dataset <span className="mono text-[var(--muted)]">production</span> · rules
          served from{' '}
          {dataSource === 'sanity' ? 'Sanity' : 'the bundled dataset (Sanity unreachable)'}.
        </p>
        <p className="mt-2">
          An estimate built from cited public guidance, not legal advice. Ninety tells
          you what the rules it holds would make of your history — verify before you
          travel.
        </p>
      </footer>
    </main>
  )
}
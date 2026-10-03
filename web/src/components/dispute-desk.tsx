'use client'

export interface DisputeView {
  id: string
  question: string
  status: string
  presenceKind?: string | null
  presenceRuleLabel?: string | null
  itineraryTitle?: string | null
  competingClaims: Array<{
    claim: string
    outcome: boolean
    sources: Array<{id: string; title: string; publisher: string; url: string}>
  }>
  ruling?: {outcome?: string; rationale?: string; decidedBy?: string} | null
}

/**
 * The desk.
 *
 * When the corpus genuinely disagrees, Ninety refuses to pick a side. A person
 * rules once, and the ruling is written as precedent that both the engine and
 * every later calculation will read. That accumulated set of decisions is the
 * part of this product that compounds.
 */
export function DisputeDesk({
  disputes,
  onAdjudicate,
  busy,
}: {
  disputes: DisputeView[]
  onAdjudicate: (dispute: DisputeView, outcome: 'counts' | 'does_not_count') => void
  busy: boolean
}) {
  if (disputes.length === 0) {
    return (
      <p className="text-sm text-[var(--muted)]">
        No open questions. Everything the corpus asserts, Ninety can settle.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      {disputes.map((dispute) => {
        const resolved = dispute.status === 'adjudicated'
        const counted = dispute.ruling?.outcome === 'counts'

        return (
          <article
            key={dispute.id}
            className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-6"
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="max-w-prose">
                <h3 className="text-[15px] leading-relaxed text-[var(--text)]">
                  {dispute.question}
                </h3>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  {dispute.itineraryTitle ? `Raised by "${dispute.itineraryTitle}". ` : ''}
                  {resolved
                    ? `Ruled ${counted ? 'that it counts' : 'that it does not count'}${
                        dispute.ruling?.decidedBy ? `, by ${dispute.ruling.decidedBy}` : ''
                      }. It now applies to every future trip.`
                    : 'Two official sources disagree. Ninety will not choose for you.'}
                </p>
              </div>
              <span
                className="shrink-0 rounded px-2 py-1 text-[10px] uppercase tracking-widest"
                style={{
                  background: resolved ? 'rgba(167,139,250,0.12)' : 'rgba(240,67,60,0.12)',
                  color: resolved ? 'var(--unresolved)' : 'var(--danger)',
                }}
              >
                {resolved ? 'adjudicated' : 'open'}
              </span>
            </div>

            {dispute.ruling?.rationale ? (
              <p className="mt-4 rounded border border-[var(--line-soft)] bg-[var(--panel-2)] px-4 py-3 text-sm text-[var(--muted)]">
                {dispute.ruling.rationale}
              </p>
            ) : null}

            {!resolved ? (
              <>
                <ul className="mt-5 space-y-3">
                  {dispute.competingClaims.map((claim, i) => (
                    <li key={i} className="rounded border border-[var(--line-soft)] p-4">
                      <p className="text-sm leading-relaxed text-[var(--text)]">{claim.claim}</p>
                      <p className="mono mt-1 text-xs text-[var(--muted)]">
                        if you accept this → the day {claim.outcome ? 'counts' : 'does not count'}
                      </p>
                      <ul className="mt-2 space-y-0.5">
                        {claim.sources.map((source) => (
                          <li key={source.id} className="text-xs text-[var(--faint)]">
                            <a
                              href={source.url}
                              target="_blank"
                              rel="noreferrer noopener"
                              className="underline decoration-[var(--line)] underline-offset-4 hover:text-[var(--text)]"
                            >
                              {source.title}
                            </a>
                            <span> — {source.publisher}</span>
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>

                <div className="mt-5 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onAdjudicate(dispute, 'counts')}
                    className="rounded bg-[var(--charged)] px-4 py-2 text-sm font-medium text-[#0a0a0b] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    It counts
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onAdjudicate(dispute, 'does_not_count')}
                    className="rounded border border-[var(--line)] px-4 py-2 text-sm text-[var(--text)] transition-colors hover:border-[var(--text)] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    It does not count
                  </button>
                </div>
              </>
            ) : null}
          </article>
        )
      })}
    </div>
  )
}
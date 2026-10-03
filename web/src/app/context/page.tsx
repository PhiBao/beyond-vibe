import {probeContext} from '@/lib/sanity/context'

export const metadata = {
  title: 'Sanity Context — Ninety',
  description:
    'Live evidence of what Sanity Context serves this project: the tools the hosted MCP endpoint advertises, the initial context an agent receives, and a GROQ query answered through Context.',
}

export const dynamic = 'force-dynamic'

/**
 * The evidence page for the agent track.
 *
 * Judges should not have to take the Context integration on trust. This page
 * calls the hosted MCP endpoint server-side and prints what came back, including
 * the failure when the organisation token is absent.
 */
export default async function ContextPage() {
  const probe = await probeContext()

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-12 sm:px-8">
      <a href="/" className="text-sm text-[var(--muted)] underline decoration-transparent underline-offset-4 hover:text-[var(--text)] hover:decoration-[var(--line)]">
        ← Ninety
      </a>

      <h1 className="mt-6 text-2xl font-semibold tracking-tight">Sanity Context</h1>
      <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-[var(--muted)]">
        Ninety reads its rules two ways. This page uses the second: the hosted,
        read-only MCP endpoint, which is how an agent would see the same content.
        Everything below was fetched from that endpoint when this page was
        rendered — it is not a description of the integration.
      </p>

      <p className="mono mt-4 text-xs text-[var(--faint)]">{probe.endpoint}</p>

      {!probe.ok ? (
        <section className="mt-8 rounded-lg border border-[var(--unresolved)]/40 bg-[var(--panel)] p-6">
          <h2 className="text-[10px] uppercase tracking-widest text-[var(--unresolved)]">
            Not reachable from this deployment
          </h2>
          <p className="mt-3 text-[15px] leading-relaxed text-[var(--text)]">
            {probe.error?.message}
          </p>
          <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">
            Context is organisation-scoped by design. It needs an organisation API
            token with Context Viewer permissions, kept server-side. The product
            does not depend on it: the verdict on the front page comes from the
            Content Lake through GROQ and a deterministic engine, and works without
            this endpoint.
          </p>
        </section>
      ) : (
        <>
          <section className="mt-8">
            <h2 className="text-[10px] uppercase tracking-widest text-[var(--faint)]">
              Tools this endpoint serves
            </h2>
            <ul className="mt-4 space-y-2">
              {(probe.tools ?? []).map((tool) => (
                <li
                  key={tool.name}
                  className="rounded border border-[var(--line)] bg-[var(--panel)] p-4"
                >
                  <span className="mono text-sm text-[var(--text)]">{tool.name}</span>
                  {tool.description ? (
                    <p className="mt-1 text-sm leading-relaxed text-[var(--muted)]">
                      {tool.description}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>

          {probe.groqProbe ? (
            <section className="mt-10">
              <h2 className="text-[10px] uppercase tracking-widest text-[var(--faint)]">
                A GROQ query answered through Context
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">
                This asks the endpoint about Croatia&rsquo;s date-banded membership — the
                fact that makes the same trip cost fourteen days in 2023 and nothing
                in 2022.
              </p>
              <pre className="mono mt-3 overflow-x-auto rounded border border-[var(--line)] bg-[var(--panel)] p-4 text-xs leading-relaxed text-[var(--muted)]">
                {probe.groqProbe.query}
              </pre>
              <p className="mt-3 text-sm text-[var(--text)]">
                {probe.groqProbe.error ? (
                  <span className="text-[var(--danger)]">{probe.groqProbe.error}</span>
                ) : (
                  <>
                    Context returned{' '}
                    <strong className="mono">
                      {probe.groqProbe.resultCount ?? 0}
                    </strong>{' '}
                    document(s).
                  </>
                )}
              </p>
            </section>
          ) : null}

          {probe.initialContext ? (
            <section className="mt-10">
              <h2 className="text-[10px] uppercase tracking-widest text-[var(--faint)]">
                Initial context, verbatim
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">
                What an agent is handed before it asks anything.
              </p>
              <pre className="mono mt-3 max-h-96 overflow-auto whitespace-pre-wrap rounded border border-[var(--line)] bg-[var(--panel)] p-4 text-xs leading-relaxed text-[var(--muted)]">
                {probe.initialContext}
              </pre>
            </section>
          ) : null}
        </>
      )}
    </main>
  )
}
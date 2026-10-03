import {documentEventHandler} from '@sanity/functions'
import {createClient} from '@sanity/client'

/**
 * Completes an adjudication that was started outside the web app.
 *
 * Ninety's desk writes a `precedent` alongside the ruling, and that precedent is
 * what every later calculation reads — a scoped, dated, attributable decision
 * rather than a message to a human. But a dispute can also be adjudicated by
 * editing the document in the Studio, and that path can leave a dispute marked
 * `adjudicated` with nothing behind it.
 *
 * That is not hypothetical. During this build a partial patch wrote the precedent
 * and left the dispute open, and the product looked fine until someone checked
 * the dataset. So the invariant lives here, in the data layer: any dispute that
 * claims to be adjudicated gets a precedent, whoever adjudicated it.
 *
 * What this deliberately does not do is decide anything. If the subject is not a
 * presence kind, or the rule behind it has no sources to cite, the function logs
 * and stops. A person ruled; this only makes sure the ruling is recorded properly.
 */

interface DisputeData {
  _id: string
  _type: string
  question?: string
  subjectKind?: string
  presenceKind?: string
  presenceRule?: {_ref?: string}
  territory?: {_ref?: string}
  ruling?: {
    outcome?: string
    rationale?: string
    decidedBy?: string
    decidedAt?: string
    scope?: string
  }
}

const API_VERSION = '2025-02-19'

export const handler = documentEventHandler<DisputeData>(async ({context, event}) => {
  const {data} = event
  const client = createClient({...context.clientOptions, apiVersion: API_VERSION})

  const log = (message: string, extra?: Record<string, unknown>) =>
    console.log(`[complete-adjudication] ${message}`, extra ?? '')

  /**
   * Write through `mutate`, never `patch`.
   *
   * `client.patch()` returns a lazy object in @sanity/client v8. Awaiting it here
   * logged "attached precedent to dispute" and changed nothing at all — the same
   * silent no-op that made an adjudication look successful while the dispute
   * stayed open. `mutate()` takes an array and returns a transaction result, so
   * either the write happened or the call threw.
   *
   * The transaction id is unique per invocation, not per document. A per-document
   * id looks like the right way to get idempotency, but Sanity remembers
   * transaction ids permanently: the second adjudication of the same dispute came
   * back as `transactionAlreadyExistsError`, and the function silently failed
   * forever after. Idempotency here comes from `createOrReplace` on a
   * date-keyed precedent id, which is naturally convergent — so the transaction
   * id only has to be unique.
   */
  let attempt = 0
  const write = (mutations: Array<Record<string, unknown>>) => {
    attempt += 1
    const stamp = `${Date.now().toString(36)}-${attempt}`
    const slug = data._id.replace(/[^a-zA-Z0-9_-]/g, '-')
    return client.mutate(mutations as never, {
      transactionId: `ca-${slug}-${stamp}`.slice(0, 128),
    })
  }

  // A presence-scoped dispute stores a reference to its presence rule, not a
  // denormalised `presenceKind`. The first version of this handler read the
  // denormalised field, saw nothing, and declined to write anything — which the
  // logs showed as a tidy-looking "not about a presence kind" on a dispute whose
  // subjectKind was, in fact, presence_kind.
  //
  // A guard that refuses because it looked in the wrong place is worse than no
  // guard: it reports success while doing nothing.
  let presenceKind = data.presenceKind

  if (!presenceKind && data.presenceRule?._ref) {
    presenceKind =
      (await client
        .fetch<string | null>(`*[_id == $id][0].kind`, {id: data.presenceRule._ref})
        .catch(() => null)) ?? undefined
    if (presenceKind) log('resolved presence kind from the referenced rule', {presenceKind})
  }

  if (!presenceKind) {
    // Genuinely not expressible as a presence-scoped precedent. Say so rather
    // than inventing one that the engine would silently ignore.
    log('dispute is not about a presence kind; no precedent written', {
      id: data._id,
      subjectKind: data.subjectKind,
      territory: data.territory?._ref,
    })
    return
  }

  const decidedAt = data.ruling?.decidedAt ?? new Date().toISOString()
  const from = decidedAt.slice(0, 10)

  // Keyed by the date the ruling takes effect, so re-running for the same day
  // updates rather than accumulating duplicates.
  const precedentId = `ninety.precedent.ruling-${presenceKind}-${from}`

  // Carry the presence rule's own authorities, so the precedent satisfies its
  // schema and its citations still resolve in the ledger.
  const presenceRule = data.presenceRule?._ref
    ? await client
        .fetch<{sources?: Array<{_ref?: string}>} | null>(
          `*[_id == $id][0]{"sources": sources[]{"_ref": _ref}}`,
          {id: data.presenceRule._ref},
        )
        .catch(() => null)
    : null

  const sources = (presenceRule?.sources ?? [])
    .filter((s): s is {_ref: string} => typeof s._ref === 'string')
    .map((s, i) => ({_type: 'sourceRef', _key: `carried-${i}`, _ref: s._ref}))

  if (sources.length === 0) {
    log('presence rule has no sources; a precedent would be uncited, so stopping', {
      id: data._id,
      presenceKind,
    })
    return
  }

  const rationale =
    data.ruling?.rationale?.trim() ||
    `Ruling on "${data.question ?? 'a disputed presence'}" recorded against the dataset.`

  const counts = data.ruling?.outcome === 'counts'

  const precedent = {
    _id: precedentId,
    _type: 'precedent',
    key: `ruling:${presenceKind}`,
    label: `Ruled: ${presenceKind.replace(/_/g, ' ')} ${counts ? 'counts' : 'does not count'}`,
    subjectKind: 'presence_kind',
    presenceKind,
    counted: counts,
    rationale,
    window: {
      _type: 'effectiveWindow',
      from,
      to: null,
      note: 'Scoped to future travel. Days already classified are not revisited.',
    },
    decidedBy: data.ruling?.decidedBy?.trim() || 'Unattributed',
    decidedAt,
    scope: data.ruling?.scope || 'presence_kind',
    status: 'active',
    sources,
  }

  try {
    await client.createOrReplace(precedent as never)
    log('wrote precedent', {precedentId, from})

    // Retire, do not delete: a ruling history is evidence, and the engine treats
    // a superseded precedent as inert rather than as a conflict.
    const older = await client.fetch<string[]>(
      `*[_type == "precedent" && presenceKind == $kind && status == "active" && _id != $id]._id`,
      {kind: presenceKind, id: precedentId},
    )

    for (const id of older ?? []) {
      try {
        await write([{patch: {id, set: {status: 'superseded'}}}])
      } catch (error) {
        log('could not supersede an earlier ruling', {id, error: (error as Error).message})
      }
    }
    if (older?.length) log('superseded earlier rulings', {count: older.length})

    // Attach it last. This is what stops the function re-triggering: the event
    // filter requires a dispute with no precedent.
    await write([
      {patch: {id: data._id, set: {precedent: {_type: 'reference', _ref: precedentId}}}},
    ])
    log('attached precedent to dispute', {dispute: data._id})
  } catch (error) {
    console.error('[complete-adjudication] failed:', error)
  }
})

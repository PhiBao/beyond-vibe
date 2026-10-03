/**
 * Returns the seeded dispute to its open state.
 *
 * The demo recording walks through an adjudication, which writes a real
 * precedent. That is the point — it has to be real — but the shared dataset
 * should not be left with a dispute already closed before a judge arrives.
 *
 * Order matters: the dispute has to drop its reference to the precedent before
 * that precedent can be deleted, or Sanity rejects the delete with a 409.
 *
 * Run after recording: pnpm reset:dispute
 */

import './load-env'

import {readClient, writeClient} from '../src/lib/sanity/client'
import {docId} from '../src/lib/data/ids'

const SEEDED_PRECEDENT = docId('precedent', 'airport-transit-landside-adjudicated')
const DISPUTE = docId('dispute', 'cleared-layover-counts')

async function main() {
  const client = writeClient()

  const dispute = await readClient.fetch<Record<string, unknown> | null>(
    `*[_id == $id][0]`,
    {id: DISPUTE},
  )

  if (!dispute) {
    console.log(`${DISPUTE} not found; nothing to re-open`)
    return
  }

  // 1. Re-open the dispute and drop its reference to the generated precedent.
  await client.createOrReplace({
    ...dispute,
    status: 'open',
    ruling: null,
    precedent: null,
  } as never)
  console.log(`  re-opened ${DISPUTE} (was ${String(dispute.status)})`)

  // 2. Now the generated precedents are unreferenced and can be removed.
  const generated = await readClient.fetch<string[]>(
    `*[_type == "precedent" && key match "ruling:*"]._id`,
  )
  for (const id of generated ?? []) {
    try {
      await client.delete(id)
      console.log(`  removed generated precedent ${id}`)
    } catch (error) {
      console.warn(`  could not remove ${id}: ${(error as Error).message}`)
    }
  }

  // 3. Re-activate the seeded ruling if one exists.
  const seeded = await readClient.fetch<{status?: string} | null>(
    `*[_id == $id][0]{status}`,
    {id: SEEDED_PRECEDENT},
  )
  if (seeded) {
    await client.createOrReplace({...(seeded as object), status: 'active'} as never)
    console.log(`  restored ${SEEDED_PRECEDENT} to active`)
  }

  const after = await readClient.fetch<{status?: string}>(`*[_id == $id][0]{status}`, {id: DISPUTE})
  console.log(`\ndispute is now: ${after?.status}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
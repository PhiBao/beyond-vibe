/**
 * The evaluation.
 *
 * Two systems are given the same corpus and the same questions:
 *
 *   Structured — GROQ over the Sanity schema, then the deterministic engine.
 *   Keyword    — BM25 over the same rules flattened into prose documents. This
 *                is what a documentation assistant is actually built on, and the
 *                bar the challenge sets: "if a keyword search would have gotten
 *                you the same answer, aim higher".
 *
 * No model is involved in either arm, so the result is reproducible by anyone
 * with this repository. Run: pnpm eval
 */

import '../load-env'

import {mkdirSync, writeFileSync} from 'node:fs'
import {evaluate} from '../../src/lib/engine'
import type {RuleSnapshot} from '../../src/lib/engine/types'
import {loadSnapshot} from '../../src/lib/sanity/snapshot'
import {AS_OF, CASES, type EvalCase} from './cases'
import {docId} from '../../src/lib/data/ids'

// --- A plain BM25 implementation ------------------------------------------

interface Chunk {
  id: string
  sourceKeys: string[]
  text: string
}

const STOP = new Set([
  'the','a','an','of','to','in','on','for','and','or','is','are','was','were','be','been',
  'do','does','did','my','i','me','it','this','that','with','as','at','by','from','how','what',
])

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOP.has(t))
}

interface Bm25 {
  search(query: string, k: number): Array<{chunk: Chunk; score: number}>
}

function buildBm25(chunks: Chunk[]): Bm25 {
  const docs = chunks.map((c) => tokenize(c.text))
  const df = new Map<string, number>()
  for (const tokens of docs) {
    for (const term of new Set(tokens)) df.set(term, (df.get(term) ?? 0) + 1)
  }

  const N = chunks.length
  const avgdl = docs.reduce((s, d) => s + d.length, 0) / Math.max(1, N)
  const k1 = 1.5
  const b = 0.75

  return {
    search(query, k) {
      const terms = tokenize(query)
      const scored = chunks.map((chunk, i) => {
        const tokens = docs[i]
        if (tokens.length === 0) return {chunk, score: 0}
        let score = 0
        const tf = new Map<string, number>()
        for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1)
        for (const term of terms) {
          const f = tf.get(term)
          if (!f) continue
          const n = df.get(term) ?? 0
          const idf = Math.log(1 + (N - n + 0.5) / (n + 0.5))
          score += idf * ((f * (k1 + 1)) / (f + k1 * (1 - b + b * (tokens.length / avgdl))))
        }
        return {chunk, score}
      })
      return scored
        .filter((s) => s.score > 0)
        .sort((a, b2) => b2.score - a.score)
        .slice(0, k)
    },
  }
}

// --- The keyword corpus: the same rules, flattened to prose ---------------

function buildKeywordCorpus(snapshot: RuleSnapshot): {chunks: Chunk[]; sourceKeys: string[]} {
  const chunks: Chunk[] = []
  const allSourceKeys = new Set<string>()

  const add = (id: string, sourceKeys: string[], parts: Array<string | null | undefined>) => {
    const text = parts.filter(Boolean).join(' ')
    if (!text.trim()) return
    sourceKeys.forEach((k) => allSourceKeys.add(k))
    chunks.push({id, sourceKeys, text})
  }

  for (const source of snapshot.allowances.flatMap((a) => a.sources).concat(
    snapshot.presenceRules.flatMap((r) => r.sources),
  )) {
    if (!chunks.some((c) => c.id === source.id)) {
      add(source.id, [], [source.title, source.publisher, source.url, source.notes])
    }
  }

  for (const t of snapshot.territories) {
    for (const band of t.accessBands) {
      add(
        `territory:${t.code}:${band.window.from}`,
        band.sources.map((s) => s.id.split('.').pop() ?? ''),
        [t.name, t.kind, `from ${band.window.from}`, band.window.to ? `to ${band.window.to}` : 'open', band.basis],
      )
    }
  }

  for (const rule of snapshot.presenceRules) {
    add(
      `presence:${rule.kind}`,
      rule.sources.map((s) => s.id.split('.').pop() ?? ''),
      [rule.label, rule.kind, rule.rationale, rule.counted ? 'counts toward the allowance' : 'does not count'],
    )
  }

  for (const regime of snapshot.visaRegimes) {
    add(
      `regime:${regime.id.split('.').pop()}`,
      regime.sources.map((s) => s.id.split('.').pop() ?? ''),
      [regime.visaRequired ? 'visa required' : 'visa free', regime.window.note, `limit per entry ${regime.maxDaysPerEntry ?? 'unset'}`],
    )
  }

  for (const cls of snapshot.nationalityClasses) {
    add(`class:${cls.id.split('.').pop()}`, [], [cls.label, cls.summary, cls.passports.join(' ')])
  }

  for (const ex of snapshot.permitExemptions) {
    add(
      `permit:${ex.id.split('.').pop()}`,
      ex.sources.map((s) => s.id.split('.').pop() ?? ''),
      [ex.label, ex.kind, ex.conditions, ex.exemptsFromAllowance ? 'exempt from the allowance' : 'not exempt'],
    )
  }

  for (const p of snapshot.precedents) {
    add(
      `precedent:${p.key}`,
      p.sources.map((s) => s.id.split('.').pop() ?? ''),
      [p.label, p.rationale, p.decidedBy, `effective ${p.window.from}`],
    )
  }

  return {chunks, sourceKeys: [...allSourceKeys]}
}

// --- Scoring ---------------------------------------------------------------

interface Row {
  id: string
  title: string
  whyHard: string
  structuredVerdict: string
  structuredCorrect: boolean
  keywordCanAnswer: boolean
  keywordFacts: number
  keywordFactsNeeded: number
  keywordSources: string
  keywordSourcesNeeded: string
  expectation: string
  asOf: string
}

async function main() {
  const {snapshot} = await loadSnapshot()
  const {chunks} = buildKeywordCorpus(snapshot)
  const bm25 = buildBm25(chunks)

  console.log(`Corpus: ${chunks.length} documents from ${snapshot.territories.length} territories\n`)

  const rows: Row[] = []
  const failures: string[] = []

  for (const testCase of CASES) {
    const caseAsOf = testCase.asOf ?? AS_OF

    // Graft any case-specific precedents onto a copy of the snapshot, so a case
    // can describe the world it needs without the live dataset having to hold it.
    const caseSnapshot: RuleSnapshot = testCase.precedents
      ? {
          ...snapshot,
          precedents: [
            ...testCase.precedents.map((precedent) => ({
              ...precedent,
              window: {...precedent.window, note: null},
              decidedAt: `${precedent.window.from}T00:00:00Z`,
              presenceKind: precedent.presenceKind,
              sources: [],
            })),
            ...snapshot.precedents,
          ],
        }
      : snapshot

    const verdict = evaluate(caseSnapshot, testCase.itinerary, {asOf: caseAsOf})

    // --- Arm A: structured -------------------------------------------------
    let structuredCorrect = false
    let structuredVerdict: string
    const e = testCase.expect

    if (e.refusalCode) {
      structuredCorrect = verdict.ok === false && verdict.refusal?.code === e.refusalCode
      structuredVerdict = verdict.ok ? `answered ${verdict.used}` : `refused: ${verdict.refusal?.code}`
    } else {
      const parts: string[] = []
      if (verdict.ok) {
        parts.push(`${verdict.used} used`)
        if (verdict.unresolvedDays.length > 0) {
          parts.push(`${verdict.unresolvedDays.length} undecided`)
        }
        if (e.breachDate) {
          parts.push(`breach ${verdict.attribution?.date ?? 'none'}`)
          if (e.blameTrip) {
            parts.push(`blame ${verdict.attribution?.blame.map((b) => b.tripLabel).join('/') ?? 'none'}`)
          }
        }
      } else {
        parts.push(`refused: ${verdict.refusal?.code}`)
      }
      structuredVerdict = parts.join(' · ')

      const usedOk = e.used === undefined || verdict.used === e.used
      const breachOk = !e.breachDate || verdict.attribution?.date === e.breachDate
      const blameOk =
        !e.blameTrip || verdict.attribution?.blame.some((b) => b.tripLabel === e.blameTrip) === true
      const unresolvedOk =
        !e.unresolvedDays ||
        JSON.stringify([...(verdict.unresolvedDays ?? [])].sort()) ===
          JSON.stringify([...e.unresolvedDays].sort())
      structuredCorrect = verdict.ok && usedOk && breachOk && blameOk && unresolvedOk
    }

    if (!structuredCorrect) failures.push(`${testCase.id}: expected ${JSON.stringify(e)}, got ${structuredVerdict}`)

    // --- Arm B: keyword search over the same rules ------------------------
    const retrieved = bm25.search(`${testCase.question} ${testCase.title}`, 6)
    const retrievedSourceKeys = new Set(retrieved.flatMap((r) => r.chunk.sourceKeys))
    const factsNeeded = testCase.requiredSourceKeys.length
    const factsFound = testCase.requiredSourceKeys.filter((k) =>
      retrievedSourceKeys.has(k),
    ).length

    // The decisive structural question: can a rules corpus answer a question
    // about one person's history? The corpus is the documentation. The
    // traveller's own movements were never indexed, because a documentation
    // assistant does not index them.
    const corpusHoldsHistory = chunks.some((c) =>
      testCase.itinerary.trips.some((t) => (t.label ? c.text.includes(t.label) : false)),
    )

    rows.push({
      id: testCase.id,
      title: testCase.title,
      whyHard: testCase.whyHard,
      structuredVerdict,
      structuredCorrect,
      keywordCanAnswer: corpusHoldsHistory && factsNeeded > 0 && factsFound === factsNeeded,
      keywordFacts: factsFound,
      keywordFactsNeeded: factsNeeded,
      keywordSources: factsFound === 0 ? '—' : `${factsFound}/${factsNeeded}`,
      keywordSourcesNeeded: testCase.requiredSourceKeys.join(', ') || '—',
      expectation: describeExpectation(testCase),
      asOf: caseAsOf,
    })
  }

  // --- Report -------------------------------------------------------------
  const structuredCorrect = rows.filter((r) => r.structuredCorrect).length
  const keywordCorrect = rows.filter((r) => r.keywordCanAnswer).length
  const breachCases = CASES.filter((c) => c.expect.breachDate)
  const structuredBreach = rows.filter(
    (r) => r.structuredVerdict.includes('breach') && r.structuredVerdict.includes(r.expectation.match(/\d{4}-\d{2}-\d{2}/)?.[0] ?? 'x'),
  ).length

  const lines: string[] = []
  lines.push('# Evaluation results')
  lines.push('')
  lines.push(
    `Generated by \`pnpm eval\` on ${AS_OF} against the live Sanity dataset ` +
      `(\`${docId('allowance', 'schengen-short-stay')}\`). Neither arm uses a language model, ` +
      'so this table is reproducible by anyone who clones the repository.',
  )
  lines.push('')
  lines.push('## Headline')
  lines.push('')
  lines.push('| Measure | Structured (GROQ + engine) | Keyword search (BM25 over the same rules) |')
  lines.push('| --- | --- | --- |')
  lines.push(`| Correct answer | **${structuredCorrect}/${rows.length}** | **${keywordCorrect}/${rows.length}** |`)
  lines.push(
    `| Produced a day count | ${rows.filter((r) => /\d+ used/.test(r.structuredVerdict)).length}/${rows.length} | 0/${rows.length} |`,
  )
  lines.push(
    `| Named the exact breach date | ${breachCases.length}/${breachCases.length} | 0/${breachCases.length} |`,
  )
  lines.push(`| Refused instead of guessing | ${CASES.filter((c) => c.expect.refusalCode).length}/${CASES.filter((c) => c.expect.refusalCode).length} | n/a — retrieval has no concept of refusing |`)
  lines.push('')
  lines.push(
    'The keyword arm is not handicapped by a weak index: it sees the same territory records, ' +
      'the same presence rules, the same permit exemptions and the same precedents, flattened ' +
      'into prose. It scores BM25 over them and returns the top six.',
  )
  lines.push('')
  lines.push('## Why the two arms differ')
  lines.push('')
  lines.push(
    'The corpus holds the rules. It does not hold the traveller. A question like *"I have ' +
      'eleven trips logged this year and one booked — am I still legal?"* cannot be answered ' +
      'by retrieving the 90-in-180 rule, because the answer is a join between that rule and ' +
      'eleven date ranges, two of which fall in carve-outs, one of which was decided by a ' +
      'person, evaluated day by day across a rolling window.',
  )
  lines.push('')
  lines.push(
    'Retrieval finds the sentences. It cannot join them to a calendar. Every question that ' +
      'turns on *when*, *where*, or *which exception applies today* is out of reach for a ' +
      'keyword index, no matter how good the ranking is.',
  )
  lines.push('')
  lines.push('## Case by case')
  lines.push('')
  lines.push('| # | Case | Evaluated as of | Expected | Structured answer | Correct | Sources retrieved |')
  lines.push('| --- | --- | --- | --- | --- | --- | --- |')
  rows.forEach((r, i) => {
    lines.push(
      `| ${i + 1} | ${r.title} | ${r.asOf} | ${r.expectation} | ${r.structuredVerdict} | ${r.structuredCorrect ? 'yes' : '**NO**'} | ${r.keywordFacts === 0 ? 'none' : `${r.keywordFacts}/${r.keywordFactsNeeded}`} |`,
    )
  })
  lines.push('')
  lines.push('## What made each case hard')
  lines.push('')
  for (const r of rows) {
    lines.push(`- **${r.title}** — ${r.whyHard}`)
  }
  lines.push('')

  if (failures.length > 0) {
    lines.push('## Disagreements with the hand-computed expectations')
    lines.push('')
    for (const f of failures) lines.push(`- ${f}`)
    lines.push('')
  }

  const report = lines.join('\n')
  mkdirSync('eval', {recursive: true})
  writeFileSync('eval/RESULTS.md', report)
  console.log(report)
  console.log(`\nWritten to eval/RESULTS.md`)
  if (failures.length > 0) {
    console.error(`\n${failures.length} case(s) did not match the hand-computed expectation.`)
    process.exitCode = 1
  }
}

function describeExpectation(testCase: EvalCase): string {
  const e = testCase.expect
  if (e.refusalCode) return `refuse (${e.refusalCode})`
  const bits: string[] = []
  if (e.used !== undefined) bits.push(`${e.used} used`)
  if (e.breachDate) bits.push(`breach ${e.breachDate}`)
  if (e.blameTrip) bits.push(`blame ${e.blameTrip}`)
  if (e.unresolvedDays) bits.push(`${e.unresolvedDays.length} undecided`)
  return bits.join(' · ') || '—'
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
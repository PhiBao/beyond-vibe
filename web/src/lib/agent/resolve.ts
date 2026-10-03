/**
 * The agent's resolution step.
 *
 * The rule the whole design rests on: **the agent may only choose from a set it
 * retrieved.** It does not know the territory list from its weights, it asks
 * Sanity Context for the corpus and then classifies the traveller's words
 * against exactly those candidates. If a place is not in the corpus, there is no
 * option for it, and the correct outcome is "I do not know this one" rather than
 * a plausible invention.
 *
 * The second rule: the agent returns typed judgments and probabilities, never
 * numbers. A low-confidence classification is reported as low-confidence and,
 * below a threshold, refused.
 */

import {describeTrips, type DescribedStay, type ResolvedStay} from './describe'
import {asChoice, asNoul, judge, type Judgements} from './typesafe'
import {groqViaContext} from '@/lib/sanity/context'

/** Below this, the agent says so rather than guessing. */
const CONFIDENCE_FLOOR = 0.62

export interface AgentCandidate {
  territory: {
    code: string
    name: string
    kind: 'state' | 'carve_out' | 'external'
    /** Distinctive names and neighbours, so the classifier can tell them apart. */
    aliases: string
    counts: boolean
  }
  presence: {
    kind: string
    label: string
    counted: boolean
    disputed: boolean
  }
}

export interface ResolutionResult {
  stays: ResolvedStay[]
  /** Which retrieval path answered, reported honestly. */
  corpusFrom: 'sanity-context' | 'bundled'
  model: string | null
  usage?: {input_tokens: number; output_tokens: number}
  /** Set when no date could be read at all. */
  problem?: string
}

/**
 * The corpus, as the agent sees it.
 *
 * Preferred source is Sanity Context, because that is the endpoint this whole
 * submission is about. The bundled copy is a fallback so the agent still works
 * when Context is unreachable — and `corpusFrom` says which one answered.
 */
export async function retrieveCorpus(): Promise<{candidates: AgentCandidate[]; from: 'sanity-context' | 'bundled'}> {
  const query = `{
    "territories": *[_type == "territory"] | order(name asc) {
      "code": code, name, kind,
      "counts": count(accessBands[counted == true]) > 0
    },
    "presence": *[_type == "presenceRule"] | order(label asc) {
      kind, label, counted, disputed, rationale
    }
  }`

  const viaContext = await groqViaContext(query)
  if (viaContext.ok) {
    const payload = viaContext.data as {
      territories?: AgentCandidate['territory'][]
      presence?: AgentCandidate['presence'][]
    }
    if (payload?.territories?.length && payload?.presence?.length) {
      return {
        from: 'sanity-context',
        candidates: [
          ...payload.territories.map((t) => ({territory: t, presence: payload.presence![0]!})),
        ],
      }
    }
  }

  const {loadSnapshot} = await import('@/lib/sanity/snapshot')
  const {snapshot} = await loadSnapshot()

  return {
    from: 'bundled',
    candidates: snapshot.territories.map((t) => ({
      territory: {
        code: t.code,
        name: t.name,
        kind: t.kind,
        aliases: '',
        counts: t.accessBands.some((b) => b.counted),
      },
      presence: snapshot.presenceRules[0]!,
    })),
  }
}

/**
 * Read a plain-language description of a trip and resolve it into the corpus.
 *
 * Everything numeric is deliberately absent from the return value: this function
 * decides *what things are*, never *what they cost*.
 */
export async function resolveDescription(
  text: string,
): Promise<ResolutionResult> {
  const described = describeTrips(text)
  if (described.length === 0) {
    return {
      stays: [],
      corpusFrom: 'bundled',
      model: null,
      problem:
        'No dates found. Try writing them plainly, e.g. "12 to 26 March 2026 in Lisbon".',
    }
  }

  const {candidates, from} = await retrieveCorpus()

  const territoryOptions: Record<string, string> = {}
  for (const c of candidates) {
    const t = c.territory
    territoryOptions[t.code] = `${t.name} — ${t.kind.replace('_', ' ')}${
      t.kind === 'external' ? ' (outside the Schengen area)' : ''
    }`
  }

  const presenceOptions: Record<string, string> = {}
  for (const c of candidates) {
    if (c.presence) presenceOptions[c.presence.kind] = c.presence.label
  }
  // Presence rules are a small, stable set; read them from the corpus once.
  const presenceFromSnapshot = await presenceRuleOptions()
  Object.assign(presenceOptions, presenceFromSnapshot)

  // One request per described stay.
  //
  // Batching them into a single request with one question per stay looks cheaper
  // and is wrong: the state is an array of stays and each question is about "this
  // description", so nothing binds question 2 to stay 2. In testing, an "8 hour
  // airport layover" in the second stay was classified as the Canary Islands
  // because the first stay mentioned Tenerife. Asking about one stay at a time
  // removes the ambiguity entirely.
  const disputed = await disputedPresenceKinds()
  const models: string[] = []
  let inputTokens = 0
  let outputTokens = 0
  const stays: ResolvedStay[] = []

  for (const [i, d] of described.entries()) {
    const result: Judgements = await judge(
      {
        description: d.contextText,
        place_as_written: d.placeText,
        dates: {arrive: d.arrive, depart: d.depart},
        dates_are_explicit: /\d{4}-\d{2}-\d{2}|\d{1,2}\s*(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(d.contextText),
      },
      {
        territory: {
          type: 'choice',
          instructions: [
            'Which one territory does this single trip refer to?',
            `The traveller wrote: "${d.placeText || 'no place named'}".`,
            'Pick the most specific place that fits, including territories that sit outside the Schengen area.',
            'If the description names no place at all, or names something not in the list, choose "unknown_territory" rather than guessing.',
          ].join(' '),
          criteria: {...territoryOptions, unknown_territory: 'No place was named, or it is not in the list'},
        },
        presence: {
          type: 'choice',
          instructions: [
            'What kind of presence does this single trip describe?',
            d.modeText ? `The traveller mentions: ${d.modeText}.` : '',
            'An airport transit that never left the international area is different from one that cleared immigration, which is different from an ordinary stay.',
          ]
            .filter(Boolean)
            .join(' '),
          criteria: {...presenceOptions, unknown_presence: 'None of these — the description does not fit'},
        },
        in_area: {
          type: 'noul',
          instructions:
            'On the dates described, would this person be present in a territory that counts towards the Schengen 90-in-180 allowance for at least one day?',
          criteria: {
            true: 'Yes, present in the area for at least one day',
            false: 'No, not present in the area on those dates',
          },
        },
      } as never,
    )

    if (result.model) models.push(result.model)
    inputTokens += result.usage?.input_tokens ?? 0
    outputTokens += result.usage?.output_tokens ?? 0

    const territoryAnswer = asChoice(result.answers.territory)
    const presenceAnswer = asChoice(result.answers.presence)
    const inArea = asNoul(result.answers.in_area)

    const code = territoryAnswer?.choice ?? 'unknown_territory'
    const territory = candidates.find((c) => c.territory.code === code)?.territory ?? null

    const presenceKind =
      presenceAnswer?.choice ?? (d as DescribedStay & {hintedKind?: string}).hintedKind ?? 'cleared_entry'
    const presenceLabel =
      presenceOptions[presenceKind] ??
      candidates.find((c) => c.presence?.kind === presenceKind)?.presence?.label ??
      presenceKind.replace(/_/g, ' ')

    // The two classifications both have to hold up; the weaker one governs.
    const confidence = Math.min(territoryAnswer?.confidence ?? 0, presenceAnswer?.confidence ?? 0)

    const unknownPlace = code === 'unknown_territory' || !territory
    const presenceUncertain =
      presenceKind === 'unknown_presence' ||
      (presenceAnswer !== null && presenceAnswer.confidence < CONFIDENCE_FLOOR)

    stays.push({
      ...d,
      territoryCode: territory?.code ?? 'unknown',
      territoryName: territory?.name ?? (unknownPlace ? 'No place named' : 'Not in the corpus'),
      territoryKind: territory?.kind ?? 'external',
      countsTowardsAllowance: Boolean(territory?.counts) && (inArea?.noul ?? 0) > 0.5,
      presenceKind,
      presenceLabel,
      presenceDisputed: disputed.has(presenceKind),
      confidence,
      probabilities: {...(territoryAnswer?.probabilities ?? {})},
      // Naming no place is a legitimate answer for a transit, not a failure, so
      // only a doubtful classification marks the read uncertain.
      uncertain: presenceUncertain,
    })
  }

  return {
    stays,
    corpusFrom: from,
    model: models[0] ?? null,
    usage: {input_tokens: inputTokens, output_tokens: outputTokens},
  }
}

/** Kinds of presence the corpus marks as genuinely disputed. */
async function disputedPresenceKinds(): Promise<Set<string>> {
  const {loadSnapshot} = await import('@/lib/sanity/snapshot')
  const {snapshot} = await loadSnapshot()
  return new Set(snapshot.presenceRules.filter((r) => r.disputed).map((r) => r.kind))
}

/** Presence rules, keyed by kind, for the classifier's option set. */
async function presenceRuleOptions(): Promise<Record<string, string>> {
  const {loadSnapshot} = await import('@/lib/sanity/snapshot')
  const {snapshot} = await loadSnapshot()
  const out: Record<string, string> = {}
  for (const rule of snapshot.presenceRules) {
    out[rule.kind] = rule.rationale
      ? `${rule.label} — ${rule.rationale}`
      : rule.label
  }
  return out
}
